"""
tools/gorsel/__init__.py
Görsel Sınıflandırıcı Tool — public API.

İki farklı model kullanıyor:
1. Vision model (varsayılan: llava) — her görseli tek tek "içeriğinde ne
   var" diye analiz eder. core/llm.py'nin complete() fonksiyonu SADECE
   metin gönderiyor (görsel/`images` alanı yok), bu yüzden bu tool core'un
   paylaşılan LLM bağlantısını kullanmıyor — kendi HTTP isteğini,
   core'la AYNI OLLAMA_URL'e (.env'den okunan) ama ek bir `images`
   alanıyla atıyor. core/llm.py'ye hiç dokunulmuyor (AGENTS.md Madde 2).
2. Metin model (core'un paylaşılan `llm_complete`'i, ör. qwen3:8b) —
   web_analyze içinde, kullanıcının isteğine göre hangi görselin hangi
   klasöre taşınacağına karar verir. Burada core'un mevcut mekanizması
   AYNEN kullanılıyor, yeni bir şey icat edilmiyor.
"""

from __future__ import annotations
import base64
import json
import os
import threading
import uuid
from io import BytesIO
from pathlib import Path

import requests

try:
    from PIL import Image
except ImportError:  # pragma: no cover — Pillow kurulu değilse ham baytlara düşülür
    Image = None

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

GORSEL_UZANTILARI = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif"}

# D5S'in scanner/walker.py'sindeki SKIP_DIRS'e benzer, taranmayacak
# sistem klasörleri — kod kopyalanmıyor (AGENTS.md Madde 1: repo
# bağımsızlığı), sadece aynı fikir tekrar yazılıyor.
_ATLANACAK_KLASORLER = {
    "$recycle.bin", "system volume information",
    ".git", ".svn", "__pycache__", "node_modules",
    "windows", "program files", "program files (x86)",
}


# ── .env dosyasını doğrudan okuma — core/llm.py ve diğer tool'larla aynı
# desen (SECURITY.md Madde 5.2): Docker'ın env_file enjeksiyonu sadece
# container ilk oluşturulduğunda çalışıyor, admin panelden/restart sonrası
# güncel değeri görmek için .env'i her seferinde taze okuyoruz.
ENV_DOSYA_YOLU = Path("/app/.env")


def _env_dosya_oku() -> dict:
    sonuc = {}
    if ENV_DOSYA_YOLU.exists():
        for satir in ENV_DOSYA_YOLU.read_text(encoding="utf-8").splitlines():
            if "=" in satir and not satir.strip().startswith("#"):
                anahtar, _, deger = satir.partition("=")
                sonuc[anahtar.strip()] = deger.strip()
    return sonuc


def _env_deger(anahtar: str, varsayilan: str = "") -> str:
    return _env_dosya_oku().get(anahtar, varsayilan)


def _vision_model_adi() -> str:
    return _env_deger("GORSEL_VISION_MODEL", "llava")


def _ollama_url() -> str:
    # core'un kendi OLLAMA_URL'i ile AYNI adres — aynı Ollama sunucusu,
    # sadece bu istekte ek bir `images` alanı taşıyor. core/llm.py'nin
    # kullandığı varsayılanla tutarlı kalsın diye aynı fallback.
    return _env_deger("OLLAMA_URL", "http://ollama:11434/api/generate")


# ── Görsel tarama — D5S'in walker.py'sinden esinlenilmiş, kopyalanmamış,
# sadece görsel dosyalara odaklanan sade bir versiyon ──────────────────────
def _gorselleri_tara(klasor: Path, max_derinlik: int = 8) -> list[Path]:
    bulunanlar: list[Path] = []

    def _yuru(mevcut: Path, derinlik: int) -> None:
        if derinlik > max_derinlik:
            return
        try:
            girdiler = list(os.scandir(mevcut))
        except (PermissionError, OSError):
            return
        for girdi in girdiler:
            try:
                if girdi.is_dir(follow_symlinks=False):
                    if girdi.name.lower() in _ATLANACAK_KLASORLER or girdi.name.startswith("."):
                        continue
                    _yuru(Path(girdi.path), derinlik + 1)
                elif girdi.is_file(follow_symlinks=False):
                    if Path(girdi.name).suffix.lower() in GORSEL_UZANTILARI:
                        bulunanlar.append(Path(girdi.path))
            except (OSError, PermissionError):
                continue

    _yuru(klasor, 0)
    return bulunanlar


# ── Vision'a gönderilecek görseli küçültme — 351 görseli ham/orijinal
# boyutta tek tek göndermek taramayı gerçek dünya testinde ~1 saatte 112/351
# görsele kadar getirdi (kullanıcı gözlemi). Vision modeli zaten kısa bir
# "içinde ne var" açıklaması istiyor — tam çözünürlük hiçbir zaman gerekmedi,
# uzun kenarı 768px'e indirmek hem model için yeterli hem de yükleme/işleme
# süresini ciddi kısaltıyor. Pillow yoksa (beklenmedik kurulum durumu)
# sessizce ham baytlara düşülür — tarama yavaş da olsa yine çalışır.
_VISION_MAX_KENAR = 768


def _vision_icin_b64_hazirla(gorsel_yolu: Path) -> str:
    if Image is not None:
        try:
            with Image.open(gorsel_yolu) as img:
                img = img.convert("RGB")
                img.thumbnail((_VISION_MAX_KENAR, _VISION_MAX_KENAR))
                buf = BytesIO()
                img.save(buf, format="JPEG", quality=85)
                return base64.b64encode(buf.getvalue()).decode("ascii")
        except Exception:
            pass  # bozuk/desteklenmeyen görsel formatı — ham baytlara düş

    with open(gorsel_yolu, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


# ── Vision model çağrısı — core/llm.py'nin DIŞINDA, tool'a özel ────────────
def _vision_complete(gorsel_yolu: Path, prompt: str) -> str:
    b64 = _vision_icin_b64_hazirla(gorsel_yolu)

    payload = {
        "model": _vision_model_adi(),
        "prompt": prompt,
        "images": [b64],
        "stream": False,
    }
    try:
        r = requests.post(_ollama_url(), json=payload, timeout=120)
        r.raise_for_status()
        return r.json().get("response", "").strip()
    except requests.RequestException as e:
        raise RuntimeError(f"Vision model isteği başarısız: {e}")


# ── İş (job) durumu — Toplantı Notları'ndaki is_baslat/durum/sonuç deseninin
# aynısı: uzun süren görsel analizi core'un senkron /api/analyze'ine
# sığmıyor, bu yüzden tool'un kendi router'ında (bkz. web.py) arka planda
# çalıştırılıp poll ediliyor. ──────────────────────────────────────────────
_is_store: dict[str, dict] = {}
_is_store_kilit = threading.Lock()


def is_baslat(klasor: Path) -> str:
    is_id = str(uuid.uuid4())
    with _is_store_kilit:
        _is_store[is_id] = {"durum": "isleniyor", "toplam": 0, "tamamlanan": 0, "sonuc": None, "hata": None}

    def _calis():
        try:
            gorseller = _gorselleri_tara(klasor)
            with _is_store_kilit:
                _is_store[is_id]["toplam"] = len(gorseller)

            sonuc = []
            # Prompt İNGİLİZCE — llava gibi vision modelleri Türkçe talimatlarda
            # tutarsız/anlamsız metin üretiyor (denendi, doğrulandı). Kısa İngilizce
            # açıklama yeterli: Türkçe gruplama kararını zaten sonraki adımda core'un
            # paylaşılan metin modeli (ör. qwen3:8b, çok dilli) veriyor.
            prompt = "What is in this image? Answer in one short sentence (max 8 words), in English. Do not add anything else."
            for i, yol in enumerate(gorseller):
                try:
                    aciklama = _vision_complete(yol, prompt)
                except RuntimeError as e:
                    aciklama = f"(analiz edilemedi: {e})"
                sonuc.append({
                    "id": f"g{i+1}",
                    "yol": str(yol),
                    "goreli_yol": str(yol.relative_to(klasor)),
                    "aciklama": aciklama,
                })
                with _is_store_kilit:
                    _is_store[is_id]["tamamlanan"] = i + 1

            with _is_store_kilit:
                _is_store[is_id]["durum"] = "tamam"
                _is_store[is_id]["sonuc"] = sonuc
        except Exception as e:
            with _is_store_kilit:
                _is_store[is_id]["durum"] = "hata"
                _is_store[is_id]["hata"] = str(e)

    threading.Thread(target=_calis, daemon=True).start()
    return is_id


def is_durumu(is_id: str) -> dict:
    with _is_store_kilit:
        girdi = _is_store.get(is_id)
    if not girdi:
        return {"durum": "bulunamadi"}
    return {
        "durum": girdi["durum"], "toplam": girdi["toplam"],
        "tamamlanan": girdi["tamamlanan"], "hata": girdi.get("hata"),
    }


def is_sonucu(is_id: str) -> list[dict] | None:
    with _is_store_kilit:
        girdi = _is_store.get(is_id)
    if not girdi or girdi["durum"] != "tamam":
        return None
    return girdi["sonuc"]


# web.py bu modüldeki fonksiyonlara bağımlı — import en sonda (circular import önlemi).
from .web import web_analyze, web_execute, web_rollback, router  # noqa: E402
