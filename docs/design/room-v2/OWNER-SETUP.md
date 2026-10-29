# Hesap/dağıtım işleri — bu tasarım tesliminden ayrı

Claude'un ilettiği liste bağlam olarak korundu; aşağıdaki işler bu asset tesliminde yapılmadı veya doğrulanmadı.

- GitHub görünürlüğü inceleme anında PUBLIC. Private'a geçiş ayrıca yapılacak; bu pakette değiştirilmedi.
- Supabase gina-prod / Frankfurt: hesap/proje kurulumu doğrulanmadı. Anonymous sign-in, email doğrulama ve token hook kararlarını auth tasarımı/migration'larla eşleştir; hook migration'dan önce seçilemez. Canlı güvenlik ayarlarını bu dosyaya bakarak körlemesine değiştirme.
- Expo/EAS proje bağlantısı ve token: doğrulanmadı. Token'ı mesaj/repo/ZIP'e koyma; yerel güvenli ortamda sakla.
- App Store Connect Gina Aile, bundle com.enescevik.gina, SKU gina-2026 ve API anahtarı: doğrulanmadı. .p8/Key ID/Issuer ID burada yok.
- Domain, Resend/DNS, sonraki Google/Cloudflare/Anthropic hesapları ve hukuk/muhasebe takibi: sahibiyle ayrı yürütülecek. `docs/legal` metinleri taslak; onaylanmış hukuki durum sayılmaz.

Tasarım/asset PR'larının merge edilmesi bu servislerin kurulduğu veya TestFlight'a hazır olunduğu anlamına gelmez.
