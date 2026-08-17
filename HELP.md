# Görsel Sınıflandırıcı — Kullanım Kılavuzu

Görsel Sınıflandırıcı, bir klasördeki fotoğrafları içeriklerine göre
otomatik gruplayıp isteğinize uygun alt klasörlere taşıyan bir asistandır.

## Klasör seçme ve tarama

**1.** **"📁 Klasör Seç"**e basıp fotoğrafların bulunduğu klasörü seçin.

**2.** **"🔍 Görselleri Tara"**ya basın — klasördeki (ve alt klasörlerdeki)
tüm görseller tek tek analiz edilir. İlerleme çubuğu kaç görselin
tamamlandığını gösterir. Görsel sayısına ve bilgisayarınızın hızına göre
bu birkaç dakika sürebilir.

**3.** Tarama bitince her görselin kısa bir açıklaması listelenir (ör.
"bir kedi fotoğrafı, uyuyor").

## İstek yazma ve plan oluşturma

Sol panelde, görselleri hangi kritere göre gruplamak istediğinizi yazın —
ör. *"ağaç olan resimleri Ağaç klasörüne, deniz olan resimleri Deniz
klasörüne topla"*. Ne kadar net yazarsanız sonuç o kadar isabetli olur.

**"📋 Plan Oluştur"**a basınca yapay zeka, görsel açıklamalarını ve
isteğinizi okuyup hangi görselin hangi klasöre taşınacağına karar verir ve
size bir plan gösterir (dosya → hedef klasör).

## Onaylama

Plandaki her satırın yanında bir onay kutusu var — istemediğiniz bir
taşımayı işaretten çıkarabilirsiniz. **"✓ Onayla ve Taşı"**ya basınca
sadece işaretli olanlar taşınır.

## Geri alma

Taşıma bittikten sonra beliren **"↩ Geri Al"** butonu, az önce taşınan
tüm görselleri eski konumlarına geri taşır. Sayfayı kapatıp tekrar
açarsanız bu buton görünmeyebilir — aynı oturum içinde kullanmanız
önerilir.

## Sık sorulan sorular

**Bir görselde birden fazla şey varsa (ör. hem ağaç hem deniz) ne olur?**
Şu an her görsel için tek bir açıklama ve tek bir hedef klasör üretiliyor
— modelin en belirgin bulduğu şeye göre karar verilir. Bir görselin aynı
anda birden fazla klasöre kopyalanması şu an desteklenmiyor.

**Görsel açıklamaları neden bazen yanlış/eksik?**
Vision modelinin (varsayılan `llava`) yorumuna bağlı — özellikle karmaşık
veya belirsiz görsellerde açıklama beklediğinizden farklı olabilir. Bu
durumda isteğinizi daha spesifik yazmak (ör. renk, nesne türü belirtmek)
sonucu iyileştirebilir.

**Taranan görsellerim nerede saklanıyor?**
Hiçbir yerde kopyalanmıyor — sadece analiz ediliyor. Kalıcı olarak
saklanan tek şey, onayladığınız taşıma işleminin geri alınabilmesi için
tutulan küçük bir kayıt dosyasıdır (kaynak/hedef yol bilgisi).
