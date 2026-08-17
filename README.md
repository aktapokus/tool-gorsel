# Görsel Sınıflandırıcı

Bir klasördeki görselleri içeriklerine göre analiz edip kullanıcının serbest
metin isteğine uygun alt klasörlere taşıyan Aktapokus Tool'u (ör. "ağaç olan
resimleri Ağaç klasörüne, deniz olan resimleri Deniz klasörüne topla").
`core.*` namespace, Faz 1 (reversible/IT-domain).

## Ne yapar

1. **Tarama** — seçilen klasördeki tüm görselleri (jpg/jpeg/png/gif/bmp/
   webp/tiff, alt klasörler dahil) bulur, her birini tek tek bir **vision
   modeline** (varsayılan `llava`) gönderip kısa bir Türkçe açıklama alır
   ("bir ağacın fotoğrafı, yeşil yapraklı" gibi).
2. **Gruplama** — kullanıcı isteğini yazınca, tüm görsel açıklamaları +
   istek core'un paylaşılan metin modeline (ör. `qwen3:8b`) gönderilir;
   model hangi görselin hangi alt klasöre gitmesi gerektiğine karar verir.
3. **Plan/onay/uygula** — D5S'teki gibi önce bir plan gösterilir (hangi
   dosya nereye), kullanıcı onaylar, sonra taşınır. Tamamen geri alınabilir.

## Neden iki farklı model kullanıyor

core'un paylaşılan LLM bağlantısı (`core/llm.py`) sadece metin gönderiyor —
görsel (`images`) alanı yok. Bu tool, Gmail'in kendi kategorizasyon
modelini ya da Toplantı Notları'nın kendi whisper/pyannote'unu kullanması
gibi, **kendi vision model bağlantısını** kuruyor: core'un `.env`'indeki
`OLLAMA_URL`'e aynı `/api/generate` uç noktasına, sadece ek bir `images`
(base64) alanıyla istek atıyor. `core/llm.py`'ye hiç dokunulmuyor.
Gruplama kararı ise (metin işi) core'un mevcut, paylaşılan metin modeli
mekanizmasını aynen kullanıyor — burada hiçbir şey yeniden icat edilmiyor.

**Ölçek notu:** CPU'da (GPU desteği core'un `docker-compose.yml`'inde şu an
tanımlı değil) görsel başına vision model çıkarımı birkaç saniyeden onlarca
saniyeye kadar sürebilir. Çok sayıda görsel içeren klasörlerde toplam süre
uzun olabilir — bu yüzden tarama arka planda/polling ile yapılır, kullanıcı
ilerlemeyi görür.

## Kurulum

1. Bu repo'yu klonlayın, `setup.bat`'ı çalıştırın — core klasörünün yolunu
   soracak, dosyaları kopyalayıp container'ı yeniden başlatacak ve vision
   modelini (`llava`, ~4.7 GB) otomatik indirecek.
2. Farklı bir vision modeli kullanmak isterseniz core'un `.env` dosyasına
   `GORSEL_VISION_MODEL=<model_adi>` satırını ekleyip ilgili modeli
   `ollama pull <model_adi>` ile indirin.

## Veri depolama

Taşıma işlemlerinin geri alınabilmesi için `data/oturumlar/` altında basit
bir JSON oturum kaydı tutulur (kaynak/hedef yol çiftleri) — taşınan
görsellerin kendisi bu klasöre kopyalanmaz, sadece nereden nereye
taşındıkları kaydedilir. Geri alma yapıldığında ya da isteğe bağlı olarak
kayıt dosyası silinir.

## Mimari

`web.py`, `web_analyze`/`web_execute`/`web_rollback`'i (AGENTS.md Madde 3)
expose eder — bu üçü SADECE tarama bittikten sonra (görsel açıklamaları +
kullanıcı isteği hazır olduktan sonra gruplama kararı + taşıma + geri alma)
devreye girer. Görsel tarama + vision model analizi, core'un senkron
`/api/analyze` sözleşmesine sığmadığı için kendi `router`'ında yaşar
(AGENTS.md Madde 4.1 — Toplantı Notları'nın ses işleme akışıyla birebir
aynı desen): `POST /tara/baslat`, `GET /tara/durum/{is_id}`,
`GET /tara/sonuc/{is_id}`.

İş (job) durumu bellek-içi tutulur — process yeniden başlarsa yarım kalan
bir tarama da zaten anlamını yitirir, kullanıcı yeniden tarar.

Rollback, D5S'in SQLite tabanlı audit log'undan daha basit — dosya tabanlı
bir JSON session log (folder5s'in sadeliğiyle aynı seviye). Bu tool'un
işlem hacmi için bilinçli bir v0.1 kapsam kararı.

## Katkı

Ana core repo'sundaki MANIFESTO.md ve AGENTS.md'yi okuyun. Görsel içinde
birden fazla nesne olduğunda (ör. hem ağaç hem deniz olan bir fotoğraf)
şu an tek bir açıklama/tek bir hedef klasör üretiliyor — çoklu etiketleme
ve bir görselin birden fazla klasöre kopyalanması bilinçli olarak v0.1
kapsamı dışında.
