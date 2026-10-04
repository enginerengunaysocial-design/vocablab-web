# VocabularyLab Uygulama Planı

## Ürün kapsamı
VocabularyLab; 2–12. sınıflar için İngilizce kelime pratiği sunan, kullanıcıyı sınıf → ünite → soru akışında ilerleten sade ve responsive bir web uygulamasıdır. Başlangıç içeriği kullanıcının gönderdiği `sınıflarünitelerkelimeler.txt` belgesinden oluşturulacak. Sunucu ve managed MySQL veritabanı, içerik yönetimi ve ziyaretçi istatistiklerinin kalıcı tutulması için kullanılacak.

## Uygulama yaklaşımı
- React + TypeScript arayüz; mevcut web-db-user starter yapısı ve tRPC katmanı korunacak.
- Veritabanında sınıflar, üniteler, kelimeler, reklam alanları ve ziyaret istatistikleri için uygulama tabloları bulunacak. Başlangıç verisi yalnızca boş kayıtları dolduracak şekilde seed edilecek; admin değişiklikleri yeniden başlatmada ezilmeyecek.
- Admin paneli için kullanıcı tarafından verilen erişim bilgileriyle uygulama içi, cookie tabanlı bir yönetici oturumu kullanılacak. Oturum çerezi public HTTPS Preview iframe uyumluluğu için `SameSite=None; Secure` olarak ayarlanacak; backend admin endpointleri kimlik doğrulamasını zorunlu tutacak.
- Kullanıcı akışı: sınıf seçimi → ünite seçimi → karıştırılmış kelime listesi → dört şıklı soru. Her ünite kelimesi bir kez sorulacak; seçim sonrası 1.2 saniye içinde yeni soruya geçilecek. Yanlış yanıtta doğru seçenek gösterilecek.
- Telaffuz için tarayıcı `SpeechSynthesis` API kullanılacak; `en-GB` tercih edilecek. Doğru/yanlış ses efektleri Web Audio API ile küçük, harici dosya gerektirmeyen tonlar olarak üretilecek.
- Reklam bileşeni başlangıçta boş placeholder olacak; admin tarafından AdSense slot/etiket, metin, görsel veya güvenli video/embed konfigürasyonu girilebilecek.
- Günlük ve aylık ziyaret sayıları sunucu tarafında tarih kovalarıyla tutulacak; admin dashboard bu değerleri gösterecek.

## Tasarım sistemi
### Design Movement
**Editorial learning dashboard / soft neo-brutalist eğitim arayüzü**: ders çalışma ciddiyetini, dergi benzeri tipografik hiyerarşi ve küçük neon vurgu alanlarıyla birleştirir.

### Core Principles
1. **Net ilerleme:** her ekranda kullanıcının sınıf, ünite ve soru durumunu açıkça göster.
2. **Az ama karakterli:** büyük boşluklar, güçlü başlıklar ve tek vurgu rengi; gereksiz dekorasyon yok.
3. **Düşük sürtünme:** tek tıkla sınıf/ünite seçimi, büyük dokunma hedefleri, erişilebilir kontrast.
4. **Kontrollü enerji:** quiz geri bildiriminde hızlı ama sakin animasyonlar; başarı ve hatayı renk + ses ile destekle.

### Color Philosophy
Krem-beyaz zemin, mürekkep lacivert metin ve kendine ait **lime/chartreuse** vurgu; öğrenmeyi taze, enerjik ve akılda kalıcı hissettirir. Yeşil doğru, kırmızı yanlış feedback rengi olarak yalnızca quiz bağlamında kullanılır. Koyu modda aynı lime vurgu koyu lacivert yüzeylerde öne çıkar.

### Layout Paradigm
Merkezi kart yığını yerine, sol kenarda ince dikey marka/ilerleme rayı ve sağda esnek içerik alanı. Ana sayfada üstte bir “study desk” başlığı, altında yatay kaydırılabilen sınıf rail’i ve ünite kartları; quiz ekranında soru kartı ile yanında oturum özeti.

### Signature Elements
- Lime renkli küçük “LAB NOTE” etiketleri ve section numaraları.
- Dergi sayfası hissi veren hairline border çizgileri ve köşeli panel başlıkları.
- Sınıf seçiminde büyük 2–12 rakamları, quizde ince progress bar.

### Interaction Philosophy
Seçimler aktif olduğu anda renk ve küçük translate/scale tepkisi verir; sonuçlar toast yerine doğrudan buton durumuyla görünür. Admin formları kullanıcıyı veri kaybından koruyacak şekilde düzenle/sil eylemlerini görünür tutar.

### Animation
- Sayfa/section girişleri 180–260ms fade + translateY.
- Quiz seçenekleri seçilince 150ms renk geçişi; cevap sonrası 1.2s bekleme.
- Hover’da 1–2px yükselme; büyük sıçrama ve sürekli hareket yok.
- Koyu mod geçişi renkleri 220ms’de yumuşakça değiştirir.

### Typography System
Başlıklarda **Space Grotesk**, gövde ve arayüzde **DM Sans**; fallback olarak system sans. H1 56/1, H2 32/1.1, section label 11px uppercase letter-spacing, body 15–16px. Türkçe karakterler için font fallback korunur.

### Brand Essence
“İngilizce kelimeleri küçük, düzenli tekrarlarla kalıcılaştıran sınıf arkadaşı.” Kişilik: **odaklı, enerjik, güvenilir**.

### Brand Voice
Kısa ve cesaretlendirici: “Bugün kaç kelimeyi cebine koyacaksın?” / “Bir sonraki kelime hazır.”

### Wordmark & Logo
Varsayılan bir yazı tipi logosu yerine, lime bir kare içinde üç kısa yatay çizgi ve yanında `VocabularyLab` kelime markası. Kare, laboratuvar notu/flashcard fikrini temsil eder.

### Signature Brand Color
`#C8F169` lime/chartreuse.

## Proje yapısı
- `client/src/pages/Home.tsx`: ana sayfa, sınıf/ünite seçimi, quiz akışı, reklam/iletişim bölümü.
- `client/src/pages/Admin.tsx`: admin giriş ekranı, dashboard metrikleri ve içerik/reklam yönetim ekranı.
- `client/src/components/`: header, ad placeholder, quiz options, admin form bileşenleri.
- `client/src/lib/`: tRPC client ve yardımcılar.
- `server/routers.ts`: public içerik/istatistik endpointleri ve admin yetkili CRUD endpointleri.
- `server/db.ts`: içerik, admin session, ziyaretçi ve reklam sorguları.
- `drizzle/schema.ts` + `drizzle/*.sql`: uygulama tabloları ve migration.
- `client/src/data/seed.ts`: text belgesinden üretilen başlangıç içerik verisi.
- `public/manus-routes.json`: `/`, `/admin`, `/404` route manifesti.

## Teslim kapsamı ve varsayımlar
- Admin erişim bilgileri kullanıcı tarafından açıkça verildiği için uygulama seed admin hesabını bu bilgilerle oluşturur; gerçek üretim güvenliği için yayından sonra bu parolanın değiştirilmesi önerilir.
- Browser speech synthesis kullanıcının cihazındaki İngilizce ses motoruna bağlıdır; mümkün olduğunda `en-GB` sesi seçilir.
- Google AdSense onayı/hesap bağlantısı dış bir Google hesabı ve yayıncı kodu gerektirir; uygulama slot ve script alanlarını hazırlar, gerçek yayıncı kodu admin tarafından girilir.
