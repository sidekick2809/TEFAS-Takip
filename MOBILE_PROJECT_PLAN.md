# TEFAS-Takip Mobile Application Conversion Project Plan

## Overview

This comprehensive project plan outlines the conversion of the TEFAS-Takip web application (a Turkish mutual fund tracking platform) to native mobile applications for Android and iOS. The plan is based on analysis of the existing codebase including `transactions.js`, `main.js`, `server.js`, and supporting files.

---

## 1. Project Overview

### Purpose
Create a mobile companion app enabling Turkish investors to monitor portfolios, analyze TEFAS fund data, and track performance metrics from smartphones.

### Core Features to Migrate
- Portfolio management with buy/sell transactions
- Real-time TEFAS fund data display
- Dashboard analytics with charts
- Fund search and filtering
- BES (pension) fund tracking
- Cash flow analysis
- KAP notifications
- Favorites system
- Dark/light theme support

---

## 2. Technology Stack Recommendation

### Framework: React Native (Recommended over Flutter)

**Justification:**
1. **JavaScript Continuity** - Existing codebase is vanilla JavaScript; React Native uses JavaScript/TypeScript
2. **Component Architecture** - Web app's modular structure maps naturally to React components
3. **Ecosystem** - Mature libraries for charts (`react-native-chart-kit`), storage (`MMKV`), navigation (`React Navigation`)
4. **API Compatibility** - Existing Express backend works seamlessly with mobile
5. **Expo Support** - Streamlined build and deployment process

### Recommended Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native 0.76+ |
| Language | TypeScript 5.x |
| State | Zustand 4.x |
| Navigation | React Navigation 6.x |
| UI Components | react-native-paper 5.x |
| Storage | react-native-mmkv 2.x |
| Charts | react-native-chart-kit 6.x |
| Build | Expo SDK 52 |

---

## 3. Architecture Design

### Directory Structure

```
TEFAS-Mobile/
├── src/
│   ├── app/                    # Navigation & app config
│   │   ├── App.tsx            # Root component
│   │   ├── Navigator.tsx      # Navigation setup
│   │   └── types.ts           # Navigation types
│   ├── core/
│   │   ├── api/               # API client
│   │   │   └── apiClient.ts   # Axios instance
│   │   ├── calculations/      # Portfolio math
│   │   │   ├── portfolio.ts   # All portfolio calculations
│   │   │   └── formatters.ts  # Currency/percent formatting
│   │   ├── storage/          # MMKV abstraction
│   │   │   └── storage.ts     # Storage helpers
│   │   └── constants/        # App constants
│   │       └── theme.ts       # Colors, spacing
│   ├── features/
│   │   ├── dashboard/        # Portfolio overview
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── DashboardCharts.tsx
│   │   ├── portfolio/        # Transaction management
│   │   │   ├── PortfolioScreen.tsx
│   │   │   ├── TransactionItem.tsx
│   │   │   └── AddTransactionScreen.tsx
│   │   ├── funds/            # Fund data & search
│   │   │   ├── FundListScreen.tsx
│   │   │   ├── FundCard.tsx
│   │   │   └── FundDetailScreen.tsx
│   │   ├── bes/              # Pension funds
│   │   │   ├── BesPortfolioScreen.tsx
│   │   │   └── BesPortfoliosScreen.tsx
│   │   └── cashflow/         # Cash flow analysis
│   │       └── CashFlowScreen.tsx
│   └── shared/               # Reusable components
│       ├── FilterBottomSheet.tsx
│       └── EmptyState.tsx
├── app.json                   # Expo config
├── babel.config.js
├── tsconfig.json
└── package.json
```

### Navigation Structure

- **Bottom Tab Navigator** with 4 main tabs:
  1. Dashboard (Ana Sayfa)
  2. Funds (Fonlar)
  3. Portfolio (İşlemler)
  4. More (Diğer)
- **Stack Navigators** within each tab for detail screens

### State Management

- **Zustand** for global state:
  - Portfolio store (transactions, aggregated data)
  - Funds store (fund list, filters)
  - User preferences store (theme, settings)
- **React Query** for server state and caching

---

## 4. Feature Mapping

| Web Feature | Mobile Adaptation |
|-------------|------------------|
| Dashboard cards | ScrollView with StatCard components |
| Fund table | FlatList with FundCard items |
| Weight/P&L charts | react-native-chart-kit bar/pie charts |
| Transaction form | Full-screen modal form with validation |
| Sidebar navigation | Bottom tab navigation |
| BES portfolio | Separate screen with portfolio selector |
| Filter dropdowns | Bottom sheet with chips |
| Edit/Delete actions | Swipe gestures or long-press menu |

---

## 5. UI/UX Design

### Mobile Design Principles

1. **Information Hierarchy** - Prioritize critical data per screen
2. **Touch Optimization** - Larger tap targets (min 44pt), swipe gestures
3. **Responsive Layout** - Adaptive dimensions for different screen sizes
4. **Native Feel** - Platform-specific navigation patterns

### Color Scheme

| Color | Hex | Usage |
|-------|-----|-------|
| Primary | #4318FF | Buttons, links, highlights |
| Primary Light | #6B79FF | Secondary actions |
| Success/Up | #10B981 | Positive values, buy |
| Error/Down | #EF4444 | Negative values, sell |
| Warning | #F59E0B | Alerts |
| Background Light | #F8FAFC | Light mode background |
| Background Dark | #0F172A | Dark mode background |
| Surface | #FFFFFF / #1E293B | Cards in light/dark |
| Text Primary | #1E293B / #F1F5F9 | Main text |
| Text Secondary | #64748B / #94A3B8 | Muted text |

### Typography

| Element | Size | Weight |
|---------|------|--------|
| Screen Title | 28px | Bold (700) |
| Section Header | 20px | SemiBold (600) |
| Card Title | 16px | SemiBold (600) |
| Body | 14px | Regular (400) |
| Caption | 12px | Regular (400) |
| Numbers | 14-24px | Medium (500) |

---

## 6. Portfolio Calculation Formulas

This section contains all calculation logic extracted from the original `transactions.js` codebase.

### 6.1 Data Structures

```typescript
// Transaction type
interface Transaction {
  id: number;
  code: string;
  name: string;
  type: 'AL' | 'SAT';  // AL = Buy, SAT = Sell
  lots: number;
  buyPrice: number;
  buyDate: string;  // YYYY-MM-DD format
}

// Fund price data from API
interface FundPrice {
  code: string;
  price: number;         // Current price (FIYAT)
  price1: number;        // 1 day ago (FIYAT1)
  price7: number;        // 7 days ago (FIYAT7)
  dailyReturn: number;   // Daily % (G1)
  weeklyReturn: number;  // Weekly % (H1)
  monthlyReturn: number; // Monthly % (AY3)
  yearlyReturn: number;  // Yearly % (YIL1)
}

// Aggregated fund holding
interface FundHolding {
  code: string;
  name: string;
  totalLots: number;
  totalCost: number;
  realizedProfit: number;
  currentPrice: number;
  currentValue: number;
  avgCost: number;
  unrealizedPnL: number;
  pnlPercent: number;
  weight: number;  // % of total portfolio
}
```

### 6.2 Average Cost Calculation (FIFO Method)

**Logic**: Process transactions chronologically. On buy (AL), add lots and cost. On sell (SAT), calculate profit using average cost at that moment, then reduce lots and cost.

```typescript
function calculateAverageCost(
  transactions: Transaction[],
  fundCode: string
): { avgCost: number; totalLots: number; totalCost: number } {
  // Filter and sort chronologically (oldest first)
  const fundTxns = transactions
    .filter(t => t.code === fundCode)
    .sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

  let runningLots = 0;
  let runningCost = 0;

  for (const t of fundTxns) {
    if (t.type === 'AL') {
      // Buy: add to running totals
      runningLots += t.lots;
      runningCost += t.lots * t.buyPrice;
    } else {
      // Sell: calculate based on previous average
      const avgCost = runningLots > 0 ? runningCost / runningLots : 0;
      const saleValue = t.lots * avgCost;
      
      // Update running totals
      runningLots -= t.lots;
      runningCost -= saleValue;
      
      if (runningLots <= 0) {
        runningLots = 0;
        runningCost = 0;
      }
    }
  }

  return {
    avgCost: runningLots > 0 ? runningCost / runningLots : 0,
    totalLots: runningLots,
    totalCost: runningCost
  };
}
```

### 6.3 Realized Profit/Loss Calculation

**Logic**: Accumulate profit from all sell (SAT) transactions. Each sale uses the average cost at the time of sale.

```typescript
function calculateRealizedProfit(transactions: Transaction[]): number {
  let totalRealized = 0;
  const runningStats: Record<string, { lots: number; cost: number }> = {};
  
  // Process chronologically
  const chronological = [...transactions].sort(
    (a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id
  );

  for (const e of chronological) {
    if (!runningStats[e.code]) {
      runningStats[e.code] = { lots: 0, cost: 0 };
    }
    
    const stats = runningStats[e.code];
    
    if (e.type === 'AL') {
      // Buy transaction
      stats.lots += e.lots;
      stats.cost += e.lots * e.buyPrice;
    } else {
      // Sell transaction - calculate profit
      const avg = stats.lots > 0 ? stats.cost / stats.lots : 0;
      const profit = (e.buyPrice - avg) * e.lots;
      totalRealized += profit;

      // Update running totals
      stats.lots -= e.lots;
      stats.cost -= e.lots * avg;
      
      if (stats.lots <= 0) {
        stats.lots = 0;
        stats.cost = 0;
      }
    }
  }

  return totalRealized;
}
```

### 6.4 Unrealized P&L (Güncel Kar)

**Logic**: Current value of holdings minus total cost basis.

```typescript
function calculateUnrealizedPnL(
  fundHolding: FundHolding
): { pnl: number; pnlPercent: number } {
  const currentValue = fundHolding.totalLots * fundHolding.currentPrice;
  const pnl = currentValue - fundHolding.totalCost;
  const pnlPercent = fundHolding.totalCost !== 0 
    ? pnl / fundHolding.totalCost 
    : 0;
  
  return { pnl, pnlPercent };
}
```

### 6.5 Total Portfolio Value

**Logic**: Sum of (net lots × current price) for all funds with positive holdings.

```typescript
function calculateTotalPortfolioValue(
  transactions: Transaction[],
  priceData: Map<string, FundPrice>
): number {
  const aggLots: Record<string, number> = {};
  
  // Aggregate net lots per fund
  transactions.forEach(e => {
    if (!aggLots[e.code]) aggLots[e.code] = 0;
    aggLots[e.code] += e.type === 'AL' ? e.lots : -e.lots;
  });

  // Calculate total value
  let totalValue = 0;
  Object.entries(aggLots).forEach(([code, netLots]) => {
    if (netLots > 0.0001) {
      const price = priceData.get(code)?.price ?? 0;
      totalValue += netLots * price;
    }
  });

  return totalValue;
}
```

### 6.6 Portfolio Weights

**Logic**: Each fund's percentage of total portfolio value.

```typescript
function calculateWeights(
  fundHoldings: FundHolding[],
  totalPortfolioValue: number
): FundHolding[] {
  return fundHoldings.map(fund => ({
    ...fund,
    weight: totalPortfolioValue > 0 
      ? (fund.currentValue / totalPortfolioValue) * 100 
      : 0
  }));
}
```

### 6.7 Daily Change Calculation

**Logic**: Change in portfolio value from yesterday to today, using net lots.

```typescript
function calculateDailyChange(
  transactions: Transaction[],
  priceData: Map<string, FundPrice>
): number {
  const aggLots: Record<string, number> = {};
  
  // Aggregate net lots
  transactions.forEach(e => {
    if (!aggLots[e.code]) aggLots[e.code] = 0;
    aggLots[e.code] += e.type === 'AL' ? e.lots : -e.lots;
  });

  // Calculate daily change
  let dailyChange = 0;
  Object.entries(aggLots).forEach(([code, netLots]) => {
    if (netLots > 0.0001) {
      const fundPrice = priceData.get(code);
      if (fundPrice && fundPrice.price > 0 && fundPrice.price1 > 0) {
        const currentValue = netLots * fundPrice.price;
        const yesterdayValue = netLots * fundPrice.price1;
        dailyChange += currentValue - yesterdayValue;
      }
    }
  });

  return dailyChange;
}
```

### 6.8 Weekly Change Calculation

**Logic**: Change in portfolio value from 7 days ago to today.

```typescript
function calculateWeeklyChange(
  transactions: Transaction[],
  priceData: Map<string, FundPrice>
): number {
  const aggLots: Record<string, number> = {};
  
  transactions.forEach(e => {
    if (!aggLots[e.code]) aggLots[e.code] = 0;
    aggLots[e.code] += e.type === 'AL' ? e.lots : -e.lots;
  });

  let weeklyChange = 0;
  Object.entries(aggLots).forEach(([code, netLots]) => {
    if (netLots > 0.0001) {
      const fundPrice = priceData.get(code);
      if (fundPrice && fundPrice.price > 0 && fundPrice.price7 > 0) {
        const currentValue = netLots * fundPrice.price;
        const weekAgoValue = netLots * fundPrice.price7;
        weeklyChange += currentValue - weekAgoValue;
      }
    }
  });

  return weeklyChange;
}
```

### 6.9 Total Cost (Maliyet)

**Logic**: Net cash out = sum of (buy value) - sum of (sell value) for all transactions.

```typescript
function calculateTotalCost(
  transactions: Transaction[]
): number {
  return transactions.reduce((acc, t) => {
    const transactionValue = t.lots * t.buyPrice;
    const multiplier = t.type === 'AL' ? 1 : -1;
    return acc + (transactionValue * multiplier);
  }, 0);
}
```

### 6.10 Aggregate Holdings by Fund

**Logic**: Combine all transactions per fund to get final holdings with all metrics.

```typescript
function aggregateHoldings(
  transactions: Transaction[],
  priceData: Map<string, FundPrice>
): FundHolding[] {
  // Step 1: Calculate realized profit and running totals
  const aggregated: Record<string, {
    code: string;
    name: string;
    totalLots: number;
    totalCost: number;
    realizedProfit: number;
  }> = {};
  
  const chronological = [...transactions].sort(
    (a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id
  );

  chronological.forEach(e => {
    if (!aggregated[e.code]) {
      aggregated[e.code] = {
        code: e.code,
        name: e.name,
        totalLots: 0,
        totalCost: 0,
        realizedProfit: 0
      };
    }
    
    const fund = aggregated[e.code];
    
    if (e.type === 'AL') {
      fund.totalLots += e.lots;
      fund.totalCost += e.lots * e.buyPrice;
    } else {
      const avg = fund.totalLots > 0 ? fund.totalCost / fund.totalLots : 0;
      const profit = (e.buyPrice - avg) * e.lots;
      fund.realizedProfit += profit;
      
      fund.totalLots -= e.lots;
      fund.totalCost -= e.lots * avg;
      
      if (fund.totalLots <= 0) {
        fund.totalLots = 0;
        fund.totalCost = 0;
      }
    }
  });

  // Step 2: Build holdings with current prices
  const holdings: FundHolding[] = [];
  
  Object.values(aggregated).forEach(fund => {
    if (fund.totalLots <= 0) return; // Skip sold out
    
    const fundPrice = priceData.get(fund.code);
    const currentPrice = fundPrice?.price ?? 0;
    const currentValue = fund.totalLots * currentPrice;
    const avgCost = fund.totalLots !== 0 ? fund.totalCost / fund.totalLots : 0;
    const unrealizedPnL = currentValue - fund.totalCost;
    const pnlPercent = fund.totalCost !== 0 ? unrealizedPnL / fund.totalCost : 0;
    
    holdings.push({
      code: fund.code,
      name: fund.name,
      totalLots: fund.totalLots,
      totalCost: fund.totalCost,
      realizedProfit: fund.realizedProfit,
      currentPrice,
      currentValue,
      avgCost,
      unrealizedPnL,
      pnlPercent,
      weight: 0 // Will be calculated after total value
    });
  });

  // Step 3: Calculate weights
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  holdings.forEach(h => {
    h.weight = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
  });

  return holdings;
}
```

### 6.11 Cash Flow (Para Akışı) Calculation

**Logic**: Net flow = Today's Value - Yesterday's Value - Return Impact

```typescript
interface CashFlowResult {
  code: string;
  name: string;
  todayValue: number;
  yesterdayValue: number;
  returnImpact: number;
  netFlow: number;
  netFlowPercent: number;
}

function calculateCashFlow(
  fundCode: string,
  netLots: number,
  todayPrice: number,
  yesterdayPrice: number,
  todayTotalValue: number,     // Fund's total AUM today
  yesterdayTotalValue: number  // Fund's total AUM yesterday
): CashFlowResult {
  const todayValue = netLots * todayPrice;
  const yesterdayValue = netLots * yesterdayPrice;
  
  // Return impact = (Today Price - Yesterday Price) × Net Lots
  const returnImpact = (todayPrice - yesterdayPrice) * netLots;
  
  // Net Flow = Today Value - Yesterday Value - Return Impact
  // This removes the return effect to show actual money movement
  const netFlow = todayValue - yesterdayValue - returnImpact;
  
  const netFlowPercent = yesterdayValue > 0 
    ? (netFlow / yesterdayValue) * 100 
    : 0;

  return {
    code: fundCode,
    name: '',
    todayValue,
    yesterdayValue,
    returnImpact,
    netFlow,
    netFlowPercent
  };
}
```

---

## 7. Code Generation Prompts

Here are detailed prompts for AI code generation for each screen.

### 7.1 Dashboard Screen Prompt

```
Create a React Native TypeScript Dashboard screen for a mutual fund portfolio tracking app called TEFAS-Takip. Use react-native-paper for UI components, react-native-chart-kit for charts, and react-native-mmkv for storage.

Requirements:
- SafeAreaView with ScrollView
- Header with app title "TEFAS Takip" and theme toggle
- 2x2 Grid of StatCard components showing:
  - Top Left: "Toplam Değer" (Total Portfolio Value) in Turkish Lira
  - Top Right: "Günlük Değişim" (Daily Change) with color indicator
  - Bottom Left: "Haftalık Değişim" (Weekly Change) with color indicator  
  - Bottom Right: "Güncel Kar" (Unrealized P&L) with color indicator
- Weight distribution horizontal bar chart showing top 5 funds
- P&L distribution pie chart (green for profit, red for loss)
- "En Çok Kazandıran" (Top Gainers) list with top 3 funds
- "En Çok Kaybettiren" (Top Losers) list with top 3 funds
- Pull-to-refresh functionality

Use theme colors:
- Primary: #4318FF
- Success: #10B981  
- Error: #EF4444
- Warning: #F59E0B

Alternative theme:
- "Create a high-end mobile UI design with a 'Deep Emerald & Charcoal' dark theme. 
- Use a vertical linear gradient for the background starting from #061612 to #0a2a22. 
- Implement 'Glassmorphism' for the content cards with a subtle border stroke and background blur (frosted glass effect). 
- Components should have highly rounded corners (24px+). 
- Use 'Inter' or 'SF Pro' typography in off-white (#E0E0E0) for readability. 
- Accent buttons should be solid white with dark text for high contrast. 
- The overall vibe should be premium, sleek, and modern, focusing on financial or professional networking context.



Helper functions needed:
- formatCurrency(value: number): string - formats as "₺1.234,56"
- formatPercent(value: number): string - formats as "+12,34%"
- getPnLColor(value: number): string - returns success/error/warning color
- formatNumber(value: number, decimals: number): string

Use Zustand for state management with a portfolio store.

Include TypeScript interfaces:
interface FundHolding {
  code: string;
  name: string;
  totalLots: number;
  currentValue: number;
  unrealizedPnL: number;
  pnlPercent: number;
  weight: number;
}

interface DashboardStats {
  totalValue: number;
  dailyChange: number;
  weeklyChange: number;
  unrealizedPnL: number;
  realizedProfit: number;
}
```

### 7.2 Fund List Screen Prompt

```
Create a React Native TypeScript Fund List screen for TEFAS-Takip app.

Requirements:
- SearchBar with filter icon button
- FilterBottomSheet modal with:
  - Fund type multi-select chips (Yatırım Fonu, BES Fonu)
  - Company (Kurucu) multi-select chips
  - Status toggle (Açık/Kapalı)
- FlatList of FundCard components
- Pull-to-refresh with ActivityIndicator
- Empty state with appropriate message
- Loading skeleton while fetching

FundCard component:
- Left: Fund code (bold) + Fund name (muted)
- Center: Current price (₺X.XXXX)
- Right: Daily change percentage with colored background pill
- Favorite heart icon on far right
- Tap anywhere → navigate to FundDetailScreen
- Tap heart → toggle favorite

Search functionality:
- Filter funds by code or name (case-insensitive)
- Debounce search input by 300ms
- Show "Sonuç bulunamadı" when no matches

TypeScript interfaces:
interface Fund {
  code: string;
  name: string;
  price: number;
  dailyReturn: number;    // as decimal 0.05 = 5%
  weeklyReturn: number;
  monthlyReturn: number;
  yearlyReturn: number;
  company: string;
  type: string;
  status: 'Açık' | 'Kapalı';
  isFavorite: boolean;
}

Use Zustand store for funds data and filters.
```

### 7.3 Add Transaction Screen Prompt

```
Create a React Native TypeScript Add Transaction screen with react-hook-form and zod validation for TEFAS-Takip.

Requirements:
- Full screen modal with header (Close button, Title, Save button)
- Form with the following fields:

1. İşlem Türü (Transaction Type) - Toggle button group
   - "ALIŞ" (Buy) - green when selected
   - "SATIŞ" (Sell) - red when selected
   - Default: ALIŞ

2. Fon Seçimi (Fund Selection)
   - Search input with magnifying glass icon
   - Autocomplete dropdown showing matching funds
   - Selected fund shows code + name
   - Required validation

3. Lot Sayısı (Number of Lots)
   - Numeric keyboard input
   - Required, must be > 0
   - Label shows "1 Lot = ₺[currentPrice]" when fund selected

4. Birim Fiyat (Unit Price)
   - Numeric keyboard with decimal
   - Auto-filled from current fund price but editable
   - Required, must be > 0

5. İşlem Tarihi (Transaction Date)
   - Date picker, defaults to today
   - Cannot be future date
   - Show in DD.MM.YYYY format

6. İşlem Tutarı (Transaction Value) - Read-only calculated field
   - Shows: "Lot × Birim Fiyat = ₺X.XXX,XX"
   - Updates in real-time as inputs change

Validation rules (zod schema):
- type: "AL" | "SAT" required
- code: string, min 2 chars
- lots: number, positive, max 1000000
- buyPrice: number, positive, max 10000
- buyDate: string, date format YYYY-MM-DD, not future

On submit:
- Create transaction object with unique ID (use Date.now())
- Call onSave callback with transaction
- Show success toast
- Navigate back

TypeScript interfaces:
interface Transaction {
  id: number;
  code: string;
  name: string;
  type: 'AL' | 'SAT';
  lots: number;
  buyPrice: number;
  buyDate: string;
}

Use react-native-paper TextInput, Button, SegmentedButtons.
Style with primary color #4318FF.
```

### 7.4 Portfolio Transactions Screen Prompt

```
Create a React Native TypeScript Portfolio Transactions screen using SectionList grouped by month/year for TEFAS-Takip.

Requirements:
- Header with "Fon İşlemleri" title and Add button (+ icon)
- Summary bar at top showing:
  - İşlem Sayısı: XX
  - Toplam Yatırım: ₺X.XXX
  - Gerçekleşen Kar: ₺X.XXX (green/red based on value)
- SectionList with sections grouped by "Ay Yıl" (e.g., "Ocak 2024")
- Transaction rows with swipe actions:
  - Swipe left → Delete (red background with trash icon)
  - Swipe right → Edit (blue background with pencil icon)
- Each transaction row shows:
  - Left: Fund code (bold), Fund name below (muted)
  - Center: Type badge ("ALIŞ" green / "SATIŞ" red)
  - Right: Lots × Price = Value, Date below

Transaction row layout:
[Code/Name]     [Badge]    [Value]
                [Lots]     [Date]

- Empty state: "İşlem listeniz boş. Fon eklemek için + butonuna tıklayın."
- Pull to refresh
- Tap row → expand to show full details

Section header style:
- Sticky header
- Background: surface color
- Text: "Ocak 2024" format in Turkish

Swipeable row using react-native-gesture-handler Swipeable.

TypeScript interfaces:
interface Transaction {
  id: number;
  code: string;
  name: string;
  type: 'AL' | 'SAT';
  lots: number;
  buyPrice: number;
  buyDate: string;  // YYYY-MM-DD
}

interface Section {
  title: string;  // "Ocak 2024"
  data: Transaction[];
}

Use react-native-paper for UI.
Colors: ALIŞ=#10B981, SATIŞ=#EF4444
```

### 7.5 Cash Flow Analysis Screen Prompt

```
Create a React Native TypeScript Cash Flow (Para Akışı) Analysis screen for TEFAS-Takip.

Requirements:
- Header: "Para Akışı Analizi" with refresh button
- Date range selector with segmented buttons:
  - "Bugün" (Today)
  - "Dün" (Yesterday) 
  - "Bu Hafta" (This Week)
  - "Bu Ay" (This Month)
  - Custom (opens date picker)
- Summary cards row:
  - Toplam Giriş (Total Inflow): green
  - Toplam Çıkış (Total Outflow): red
  - Net Akış (Net Flow): green/red based on sign
- Bar chart showing daily net flow for selected period
  - X-axis: Days
  - Y-axis: Flow amount in ₺
  - Positive bars: green
  - Negative bars: red
- Fund breakdown table:
  - Columns: Fon, Bugün Değeri, Dün Değeri, Net Akış, %
  - Sortable by tapping column headers
  - Row highlight on tap

Calculation formulas:
- Today's Value = Net Lots × Today's Price
- Yesterday's Value = Net Lots × Yesterday's Price
- Net Flow = Today's Value - Yesterday's Value - Return Impact
- Return Impact = (Today's Price - Yesterday's Price) × Net Lots

TypeScript interfaces:
interface CashFlowRow {
  code: string;
  name: string;
  todayValue: number;
  yesterdayValue: number;
  returnImpact: number;
  netFlow: number;
  netFlowPercent: number;
}

interface CashFlowSummary {
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
}

Use react-native-chart-kit BarChart for visualization.
Show loading state while fetching data.
```

### 7.6 BES Portfolio Screen Prompt

```
Create a React Native TypeScript BES (Bireysel Emeklilik Sistemi) Portfolio screen for TEFAS-Takip.

Requirements:
- Portfolio selector dropdown at top (multiple BES portfolios)
- If no portfolios exist, show "Yeni Portföy Oluştur" button
- Summary cards similar to regular portfolio:
  - Toplam Birikim (Total Accumulation)
  - Günlük Değişim (Daily Change)
  - Haftalık Değişim (Weekly Change)
  - Toplam Kazanç (Total Gain)
- Holdings list similar to Dashboard
- Transaction history similar to Portfolio screen
- Add/Edit/Delete portfolio functionality:
  - Modal with portfolio name input
  - "Varsayılan" (Default) cannot be deleted

BES-specific calculations:
- Same as regular portfolio but uses BES fund prices
- Different tax treatment (not applied in display)

TypeScript interfaces:
interface BesPortfolio {
  id: number;
  name: string;
  isDefault: boolean;
}

interface BesTransaction extends Transaction {
  portfolioId: number;
}

Use react-native-paper Dropdown for portfolio selector.
```

---

## 8. API Integration

### Endpoints from Existing Backend

The mobile app will use the same Express.js backend with these endpoints:

```typescript
// Base URL - configure per environment
const API_BASE = __DEV__ 
  ? 'http://localhost:3000/api' 
  : 'https://your-production-api.com/api';

// Fund Data
GET  /api/tefas-data?type=YAT    // Regular funds (Yatırım Fonları)
GET  /api/tefas-data?type=EMK    // BES funds (Emeklilik Fonları)

// Portfolio
GET  /api/local-portfolio?fundType=YAT    // Get portfolio
POST /api/local-portfolio                  // Save portfolio
DELETE /api/local-portfolio/:id           // Delete transaction

// BES Portfolio  
GET  /api/bes-portfolios                   // List BES portfolios
POST /api/bes-portfolios                   // Create portfolio
PUT  /api/bes-portfolios/:id               // Update portfolio
DELETE /api/bes-portfolios/:id             // Delete portfolio
GET  /api/bes-portfolio/:id                // Get portfolio transactions

// Favorites
GET  /api/favorites                        // Get favorites
POST /api/favorites                        // Add favorite
DELETE /api/favorites?code=X               // Remove favorite

// KAP Notifications
GET  /api/kap?startDate=2024-01-01&endDate=2024-01-31  // Get KAP news
```

### API Client Implementation

```typescript
// src/core/api/apiClient.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth
apiClient.interceptors.request.use(config => {
  // Add auth token if needed
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => response.data,
  error => {
    if (error.code === 'ECONNABORTED') {
      throw new Error('İstek zaman aşımına uğradı');
    }
    throw new Error(error.response?.data?.message || 'Bir hata oluştu');
  }
);

export default apiClient;
```

### Offline Strategy

1. **Network First**: Try network request, fallback to cached data
2. **Mutation Queue**: Queue mutations when offline, sync when online
3. **Staleness Detection**: Store last sync timestamp, show warning if > 1 hour

```typescript
// Offline-first data fetching
async function getFunds(forceRefresh = false): Promise<Fund[]> {
  const cacheKey = 'cached_funds';
  const cacheTimeKey = 'cached_funds_time';
  
  if (!forceRefresh) {
    const cached = storage.getString(cacheKey);
    const cachedTime = storage.getNumber(cacheTimeKey);
    
    if (cached && cachedTime) {
      const hourAgo = Date.now() - 60 * 60 * 1000;
      if (cachedTime > hourAgo) {
        return JSON.parse(cached);
      }
    }
  }
  
  try {
    const data = await apiClient.get('/tefas-data?type=YAT');
    storage.set(cacheKey, JSON.stringify(data));
    storage.set(cacheTimeKey, Date.now());
    return data;
  } catch (error) {
    // Fallback to cache on network error
    const cached = storage.getString(cacheKey);
    if (cached) return JSON.parse(cached);
    throw error;
  }
}
```

---

## 9. Data Persistence

### Storage Solution: MMKV (react-native-mmkv)

MMKV provides fast, synchronous key-value storage ideal for React Native.

| Data Type | Storage Key | Format |
|-----------|-------------|--------|
| Portfolio transactions | `portfolio` | JSON array |
| BES portfolio transactions | `bes_portfolio` | JSON array |
| BES portfolio metadata | `bes_portfolios` | JSON array |
| Cached fund prices | `cache_funds` | JSON object |
| User preferences | `settings` | JSON object |
| Theme mode | `theme` | 'light' \| 'dark' |
| Favorites | `favorites` | string[] |
| Last sync timestamp | `last_sync` | number (timestamp) |

### Implementation

```typescript
// src/core/storage/storage.ts
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'tefas-app-storage' });

export const Storage = {
  // Generic getters/setters
  getString: (key: string): string | undefined => {
    return storage.getString(key);
  },
  
  setString: (key: string, value: string): void => {
    storage.set(key, value);
  },
  
  getNumber: (key: string): number | undefined => {
    return storage.getNumber(key);
  },
  
  setNumber: (key: string, value: number): void => {
    storage.set(key, value);
  },
  
  getBoolean: (key: string): boolean | undefined => {
    return storage.getBoolean(key);
  },
  
  setBoolean: (key: string, value: boolean): void => {
    storage.set(key, value);
  },
  
  delete: (key: string): void => {
    storage.delete(key);
  },
  
  clearAll: (): void => {
    storage.clearAll();
  },
  
  // JSON helpers
  getObject: <T>(key: string): T | null => {
    const value = storage.getString(key);
    return value ? JSON.parse(value) : null;
  },
  
  setObject: <T>(key: string, value: T): void => {
    storage.set(key, JSON.stringify(value));
  },
};

// Portfolio storage helpers
export const PortfolioStorage = {
  getTransactions: (): Transaction[] => {
    return Storage.getObject<Transaction[]>('portfolio') ?? [];
  },
  
  saveTransactions: (transactions: Transaction[]): void => {
    Storage.setObject('portfolio', transactions);
  },
  
  addTransaction: (transaction: Transaction): void => {
    const current = PortfolioStorage.getTransactions();
    current.push(transaction);
    PortfolioStorage.saveTransactions(current);
  },
  
  updateTransaction: (id: number, updates: Partial<Transaction>): void => {
    const current = PortfolioStorage.getTransactions();
    const index = current.findIndex(t => t.id === id);
    if (index !== -1) {
      current[index] = { ...current[index], ...updates };
      PortfolioStorage.saveTransactions(current);
    }
  },
  
  deleteTransaction: (id: number): void => {
    const current = PortfolioStorage.getTransactions();
    const filtered = current.filter(t => t.id !== id);
    PortfolioStorage.saveTransactions(filtered);
  },
};
```

---

## 10. Testing and Deployment

### Testing Strategy

- **Jest** for unit tests
- **React Native Testing Library** for component tests
- **Target 70%+ code coverage** for calculation logic

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- portfolioCalculations.test.ts
```

### Test Examples

```typescript
// __tests__/calculations/portfolio.test.ts
import {
  calculateRealizedProfit,
  calculateAverageCost,
  calculateDailyChange,
  aggregateHoldings
} from '../../src/core/calculations/portfolio';

describe('Portfolio Calculations', () => {
  const mockTransactions: Transaction[] = [
    { id: 1, code: 'FKFN', name: 'Fon A', type: 'AL', lots: 100, buyPrice: 1.0, buyDate: '2024-01-01' },
    { id: 2, code: 'FKFN', name: 'Fon A', type: 'AL', lots: 50, buyPrice: 1.1, buyDate: '2024-01-15' },
    { id: 3, code: 'FKFN', name: 'Fon A', type: 'SAT', lots: 30, buyPrice: 1.2, buyDate: '2024-02-01' },
  ];

  describe('calculateAverageCost', () => {
    it('should calculate correct average cost', () => {
      const result = calculateAverageCost(mockTransactions, 'FKFN');
      expect(result.totalLots).toBe(120);
      expect(result.totalCost).toBeCloseTo(125, 0); // 100*1 + 50*1.1 - 30*1.0333
    });
  });

  describe('calculateRealizedProfit', () => {
    it('should calculate profit from sales correctly', () => {
      const profit = calculateRealizedProfit(mockTransactions);
      // Sale: 30 * (1.2 - avgCost) where avgCost = (100 + 55) / 150 = 1.0333
      expect(profit).toBeCloseTo(5, 0);
    });
  });
});
```

### Build Commands

```bash
# Development
npx expo start                    # Start Expo
npx expo run:ios                  # Run on iOS simulator
npx expo run:android              # Run on Android emulator

# Build for Production (EAS)
eas build -p ios --profile production    # iOS App Store
eas build -p android --profile production # Google Play

# Local build (without EAS)
npx expo build:ios                        # iOS (deprecated)
npx expo build:android                    # Android (deprecated)
```

### Deployment Checklist

- [ ] Configure `app.json` with bundle identifiers
  - iOS: `bundleIdentifier: "com.tefas.takip"`
  - Android: `package: "com.tefas.takip"`
- [ ] Set up EAS project: `eas init`
- [ ] Configure App Store Connect (iOS)
  - Create App Record
  - Set up App Icons
  - Prepare Screenshots
- [ ] Configure Google Play Console (Android)
  - Create App Listing
  - Set up App Icons
  - Prepare Screenshots
- [ ] Set up CI/CD with GitHub Actions
- [ ] Prepare Store Descriptions
- [ ] Submit for Review

### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test -- --coverage
        
      - name: Build iOS
        run: npx expo run:ios --no-build-cache
        
      - name: Build Android
        run: npx expo run:android --no-build-cache
```

---

## 11. Implementation Roadmap

| Phase | Duration | Focus | Deliverables |
|-------|----------|-------|--------------|
| Phase 1 | 2 weeks | Setup & Navigation | Project init, navigation, theme, basic UI components |
| Phase 2 | 3 weeks | Portfolio Features | Transaction CRUD, calculations, storage |
| Phase 3 | 2 weeks | Fund Data | Fund list, search, filters, favorites |
| Phase 4 | 1 week | Charts | Dashboard charts, cash flow visualization |
| Phase 5 | 1 week | BES Features | BES portfolio, multiple portfolio support |
| Phase 6 | 1 week | Polish | Edge cases, error handling, performance |
| Phase 7 | 1 week | Testing & Deployment | Tests, store submission |

**Total: ~11 weeks**

---

## 12. Quick Start Prompts

### Initial Project Setup Prompt

```
Initialize a new React Native Expo project for TEFAS-Takip mobile app:
- Use Expo SDK 52
- TypeScript
- Install dependencies: 
  - zustand (state management)
  - @react-navigation/native + @react-navigation/bottom-tabs + @react-navigation/stack
  - react-native-paper (UI components)
  - react-native-mmkv (storage)
  - react-native-chart-kit (charts)
  - react-native-gesture-handler + react-native-reanimated
  - axios (HTTP client)
  - react-hook-form + zod (forms/validation)
  - @react-native-community/datetimepicker

Create the project structure:
- src/app/ (navigation)
- src/core/ (api, calculations, storage, constants)
- src/features/ (dashboard, portfolio, funds, bes, cashflow)
- src/shared/ (common components)

Configure app.json with:
- name: "TEFAS Takip"
- slug: "tefas-takip"
- primaryColor: #4318FF
- iOS bundleIdentifier: "com.tefas.takip"
- Android package: "com.tefas.takip"
```

### Store Setup Prompt

```
Create Zustand stores for TEFAS-Takip:

1. portfolioStore.ts:
   - State: transactions: Transaction[], isLoading: boolean
   - Actions: addTransaction, updateTransaction, deleteTransaction, loadFromStorage
   - Computed: aggregatedHoldings, totalValue, dailyChange, weeklyChange, realizedProfit

2. fundsStore.ts:
   - State: funds: Fund[], filters: FilterState, searchTerm: string, isLoading: boolean
   - Actions: fetchFunds, setFilters, setSearchTerm, toggleFavorite
   - Computed: filteredFunds

3. settingsStore.ts:
   - State: theme: 'light' | 'dark' | 'system', lastSync: number
   - Actions: setTheme, updateLastSync

Include TypeScript interfaces for all types.
Use react-native-mmkv for persistence.
```

---

## Summary

This project plan provides:

1. ✅ **Complete technology stack** recommendations with justifications
2. ✅ **Architecture design** with directory structure and navigation
3. ✅ **All portfolio calculation formulas** extracted from original code
4. ✅ **Detailed code generation prompts** for each screen
5. ✅ **API integration strategy** with offline support
6. ✅ **Data persistence** using MMKV
7. ✅ **Testing and deployment** guide

The mobile app will maintain feature parity with the web application while providing a native mobile experience optimized for iOS and Android devices.
