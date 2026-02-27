# TEFAS Fon Takip ve Analiz Sistemi

TEFAS verilerini gerçek zamanlı olarak izleyebileceğiniz, portföyünüzü yönetebileceğiniz ve detaylı kâr/zarar analizleri yapabileceğiniz modern bir web uygulamasıdır.

## 🚀 Özellikler

- **Dashboard:** Portföy özetiniz, toplam yatırım değeriniz, günlük değişim ve kâr/zarar durumunuzu grafiklerle izleyin.
- **Canlı Veriler:** TEFAS üzerindeki tüm fonların 1 günlükten 5 yıllığa kadar tüm getiri verilerini anlık olarak takip edin.
- **Portföy Yönetimi (İşlemler):** Fon alış ve satış işlemlerinizi kaydedin, kümülatif lot takibi yapın ve gerçekleşen kârlarınızı görün.
- **Gelişmiş Filtreleme:** Fon türü, kurucu şirket ve işlem durumu (Açık/Kapalı) bazlı detaylı filtreleme.
- **Dışa Aktarma:** Verilerinizi ve portföy durumunuzu CSV (Türkçe uyumlu) veya Excel (XLS) formatında indirin.
- **Karanlık/Aydınlık Mod:** Göz yormayan modern tasarım seçenekleri.
- **Tarih Ayarları:** Analizler için kullanılacak karşılaştırma tarihlerini manuel olarak belirleyebilme.
- **KAP Bildirimleri:** Portföyünüzdeki fonlarla ilgili KAP (Kamuyu Aydınlatma Platformu) bildirimlerini takip edin. Yatırım fonlarına ilişkin önemli duyuruları anlık olarak izleyin. Portföydeki fon hakkında duyuru varsa simle ile gösterir.
- **Para Akışı Takibi:** Portföyünüzdeki fonların, günlük portföy büyüklüğü değişimlerini analiz edin. Bugünün verisini dün ile karşılaştırarak net giriş/çıkışları görün.

### KAP Bildirimleri

KAP (Kamuyu Aydınlatma Platformu) bildirimleri sayfasında, portföyünüzde bulunan fonlarla ilgili önemli duyuruları takip edebilirsiniz:

- **Otomatik Filtreleme:** Sadece portföyünüzdeki fonlara ait bildirimler gösterilir (portföyünüzde olmayan fonlar filtrelenir)
- **Detaylı Bilgi:** Her bildirim için başlık, şirket adı, kategori ve bağlantı bilgileri
- **Tarih Bazlı Çekme:** Belirli bir tarih aralığı için bildirim çekebilme
- **Tek Tıkla Erişim:** Bildirimlerin orijinal KAP sayfasına doğrudan erişim linki

### Para Akışı (Cash Flow)

Para Akışı sayfasında, fonların portföy büyüklüklerindeki değişimleri analiz edebilirsiniz:

- **Dönem Karşılaştırması:** Bugünün verisini dün ile karşılaştırarak değişimi görün
- **Net Akış Hesaplama:** Getiri etkisinden arındırılmış gerçek para giriş/çıkışını hesaplayın
- **Manuel Tarih Ayarları:** İstediğiniz başlangıç ve bitiş tarihlerini manuel olarak belirleyebilme
- **Görsel İşaretleme:** Pozitif net akış yeşil, negatif akış kırmızı ile işaretlenir

## 🛠 Kullanılan Teknolojiler

- **Frontend:** Vanilla JS (ES6+), HTML5, CSS3 (Vanilla)
- **Grafikler:** [Chart.js](https://www.chartjs.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **API:** Kamuya açık TEFAS veri servisleri (Proxy üzerinden)

## 📦 Kurulum ve Çalıştırma

Projeyi yerel bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

1.  **Projeyi Klonlayın:**
    ```bash
    git clone https://github.com/sidekick2809/TEFAS-Takip.git
    cd TEFAS-Takip
    ```

2.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```


3.  **Geliştirme Sunucusunu Başlatın:**
    ```bash
    npm run dev
    ```

4.  **Tarayıcıda Açın:**
    Terminalde belirtilen adresi (genellikle `http://localhost:5173`) tarayıcınızda açın.

## 🐳 Docker ile Çalıştırma

Uygulamayı Docker konteyneri içerisinde çalıştırmak için aşağıdaki komutları kullanabilirsiniz:

1.  **İmajı Oluşturun:**
    ```bash
    docker build -t tefas-takip .
    ```

2.  **Konteyneri Başlatın:**
    ```bash
    docker run -d -p 8080:80 --name tefas-app tefas-takip
    ```

3.  **Veri Kalıcılığı ile Başlatın (Önerilen):**
    Portföy verilerinizin silinmemesi için `data` klasörünü dışarıya bağlamanız önerilir:
    ```bash
    docker run -d \
      -p 8080:80 \
      -v $(pwd)/data:/app/data \
      --name tefas-app \
      tefas-takip
    ```

### 🛠 Docker Compose (Daha Kolay Yol)

Eğer Docker Compose yüklü ise, sadece şu komutu çalıştırarak uygulamayı ayağa kaldırabilirsiniz:

```bash
docker-compose up -d
```

Bu komut hem imajı oluşturur, hem de veri klasörünü otomatik olarak bağlayarak uygulamayı `8080` portunda başlatır.

4.  **Erişim:**
    Tarayıcınızdan `http://localhost:8080` adresine giderek uygulamaya erişebilirsiniz.



## 📁 Dosya Yapısı

- `index.html`: Uygulamanın ana yapısı ve modal tanımları.
- `main.js`: Temel veri çekme, filtreleme ve genel uygulama mantığı.
- `transactions.js`: Portföy hesaplamaları, grafik işlemleri ve CRUD operasyonları.
- `server.js`: Docker ve yerel kullanım için Express tabanlı API ve static dosya sunucusu.
- `Dockerfile` & `docker-compose.yml`: Konteynerlaştırma yapılandırmaları.
- `style.css`: Modern, responsive ve temalı tasarım sistemi.
- `package.json`: Proje bağımlılıkları ve scriptler.


## 💾 Veri Saklama

Uygulama, verilerinizi iki katmanlı olarak saklar:

### Sunucu (SQLite Veritabanı) — Ana Depolama
Docker veya Node.js ile çalıştırıldığında tüm veriler `data/portfolio.db` SQLite veritabanı dosyasında saklanır:
- **Portföy İşlemleri:** Alım/satım kayıtları
- **TEFAS Fon Verileri:** Fiyatlar, getiriler, fon bilgileri (cache)

Bu sayede farklı tarayıcılardan veya cihazlardan eriştiğinizde verileriniz senkronize kalır.

### Tarayıcı (Local Storage) — Yedek/Cache
Çevrimdışı kullanım ve hızlı erişim için tarayıcınızda da yedeklenir.

### Veritabanı Dosyası Konumu
- **Yerel çalışma:** `data/portfolio.db`
- **Docker:** Uygulama `/app/data` klasöründe çalışır. Veri kalıcılığı için `data` klasörünü volume olarak bağlamanız (yukarıdaki Docker talimatlarında belirtildiği gibi) önemlidir.

### Otomatik Geçiş
Eğer daha önce `portfolio.json` dosyası kullanıldıysa, uygulama ilk çalıştırıldığında otomatik olarak SQLite veritabanına aktarır ve JSON dosyasını `portfolio.json.bak` olarak yedekler.


## 📄 Lisans

Bu proje kişisel kullanım ve eğitim amaçlı geliştirilmiştir. Veriler TEFAS üzerinden bilgilendirme amaçlı çekilmektedir.

---
*Not: Bu uygulama yatırım tavsiyesi vermez, sadece matematiksel verileri görselleştirir.*
