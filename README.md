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

## 🛠 Kullanılan Teknolojiler

- **Frontend:** Vanilla JS (ES6+), HTML5, CSS3 (Vanilla)
- **Grafikler:** [Chart.js](https://www.chartjs.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **API:** Kamuya açık TEFAS veri servisleri (Proxy üzerinden)

## 📦 Kurulum ve Çalıştırma

Projeyi yerel bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

1.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

2.  **Geliştirme Sunucusunu Başlatın:**
    ```bash
    npm run dev
    ```

3.  **Tarayıcıda Açın:**
    Terminalde belirtilen adresi (genellikle `http://localhost:5173`) tarayıcınızda açın.

## 📁 Dosya Yapısı

- `index.html`: Uygulamanın ana yapısı ve modal tanımları.
- `main.js`: Temel veri çekme, filtreleme ve genel uygulama mantığı.
- `transactions.js`: Portföy hesaplamaları, grafik işlemleri ve CRUD operasyonları.
- `style.css`: Modern, responsive ve temalı tasarım sistemi.
- `package.json`: Proje bağımlılıkları ve scriptler.

## 💾 Veri Saklama

Uygulama, verilerinizi ve portföy bilgilerinizi tarayıcınızın `localStorage` alanında güvenli bir şekilde saklar. Sunucu tarafında herhangi bir veri tutulmaz, verileriniz tamamen sizin cihazınızdadır.

## 📄 Lisans

Bu proje kişisel kullanım ve eğitim amaçlı geliştirilmiştir. Veriler TEFAS üzerinden bilgilendirme amaçlı çekilmektedir.

---
*Not: Bu uygulama yatırım tavsiyesi vermez, sadece matematiksel verileri görselleştirir.*
