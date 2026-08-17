"""
tools/gorsel/web.py
Görsel Sınıflandırıcı — router (tarama/is takibi) + standart
web_analyze/web_execute/web_rollback sözleşmesi (AGENTS.md Madde 3).

Akış:
  1. Kullanıcı klasör seçer → POST /tara/baslat → arka planda her görsel
     vision modelinden geçer (bkz. __init__.py: is_baslat).
  2. UI, /tara/durum ile poll eder, bitince /tara/sonuc ile açıklamaları
     alır ve ekranda gösterir.
  3. Kullanıcı "Plan Oluştur"a basınca UI, kullanıcının orijinal isteğini +
     görsel açıklamalarını TEK bir metinde birleştirip (Toplantı'daki
     TALIMAT_AYIRICI deseniyle aynı) core'un standart /api/analyze'ine
     gönderir → burada web_analyze devreye girer.
"""

from __future__ import annotations
import json
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from . import is_baslat, is_durumu, is_sonucu, DATA_DIR

router = APIRouter()

AYIRICI = "\n---AKTAPOKUS_GORSELLER---\n"

_plan_store: dict[str, dict] = {}
_oturum_dizini = DATA_DIR / "oturumlar"
_oturum_dizini.mkdir(exist_ok=True)


# ── Router uçları ───────────────────────────────────────────────────────
class TaramaBaslatIstegi(BaseModel):
    klasor: str


@router.post("/tara/baslat")
def tara_baslat(istek: TaramaBaslatIstegi):
    is_id = is_baslat(Path(istek.klasor))
    return {"is_id": is_id}


@router.get("/tara/durum/{is_id}")
def tara_durum(is_id: str):
    return is_durumu(is_id)


@router.get("/tara/sonuc/{is_id}")
def tara_sonuc(is_id: str):
    sonuc = is_sonucu(is_id)
    if sonuc is None:
        return {"hazir": False, "gorseller": []}
    return {"hazir": True, "gorseller": sonuc}


def gorsel_blok_olustur(gorseller: list[dict]) -> str:
    """UI, /tara/sonuc'tan aldığı listeyi bu formata çevirip web_analyze'e gönderir."""
    satirlar = [f"{g['id']}: {g['goreli_yol']} — {g['aciklama']}" for g in gorseller]
    return "\n".join(satirlar)


# ── Standart tool sözleşmesi ─────────────────────────────────────────────
def _json_ayikla(metin: str) -> str:
    metin = metin.strip()
    if metin.startswith("```"):
        metin = metin.split("```")[1]
        if metin.startswith("json"):
            metin = metin[4:]
    return metin.strip()


def web_analyze(istek: str, klasor: str, llm_complete):
    ham = istek or ""
    if AYIRICI in ham:
        kullanici_istegi, gorsel_blok = ham.split(AYIRICI, 1)
    else:
        kullanici_istegi, gorsel_blok = ham, ""

    kullanici_istegi = kullanici_istegi.strip()
    gorsel_blok = gorsel_blok.strip()

    if not gorsel_blok:
        return {"bos": True, "plan_id": None, "aciklama": "Önce klasördeki görselleri tarayın.", "items": []}
    if not kullanici_istegi:
        return {"bos": True, "plan_id": None, "aciklama": "Görselleri hangi kritere göre gruplamak istediğinizi yazın.", "items": []}

    # id -> göreli yol eşlemesi, blok'un kendisinden çıkarılıyor (LLM'e
    # tam dosya yolunu tekrar üretmesi/kopyalaması gerektirmeden, sadece
    # kısa id'leri seçmesi yeterli — daha güvenilir).
    id_yol_eslemesi: dict[str, str] = {}
    for satir in gorsel_blok.splitlines():
        if ":" not in satir or "—" not in satir:
            continue
        id_kismi, gerisi = satir.split(":", 1)
        goreli_yol = gerisi.split("—", 1)[0].strip()
        id_yol_eslemesi[id_kismi.strip()] = goreli_yol

    prompt = f"""Aşağıda bir klasördeki görsellerin kısa açıklamaları listelendi.
Kullanıcının isteğine göre HANGİ görsellerin HANGİ alt klasöre taşınması
gerektiğine karar ver.

Kullanıcının isteği: {kullanici_istegi}

Görseller (id: dosya — açıklama):
{gorsel_blok}

SADECE şu JSON formatında cevap ver, başka hiçbir açıklama ekleme:
{{"eslesenler": [{{"id": "g1", "hedef_klasor": "Klasör Adı"}}]}}

Kurallar:
- İsteğe uymayan görselleri listeye ekleme.
- "hedef_klasor" kısa, anlamlı, Türkçe bir klasör adı olsun.
- "id" alanına yukarıdaki listeden AYNEN kopyaladığın id'yi yaz (ör. g1, g2)."""

    ham_cevap = llm_complete(prompt, json_mode=True)
    try:
        ayrisik = json.loads(_json_ayikla(ham_cevap))
    except (json.JSONDecodeError, TypeError):
        return {"bos": True, "plan_id": None, "aciklama": "Model geçerli bir plan üretemedi, lütfen isteğinizi netleştirip tekrar deneyin.", "items": []}

    eslesenler = ayrisik.get("eslesenler", []) if isinstance(ayrisik, dict) else []
    if not eslesenler:
        return {"bos": True, "plan_id": None, "aciklama": "İsteğinize uyan görsel bulunamadı.", "items": []}

    klasor_p = Path(klasor)
    items = []
    for e in eslesenler:
        gid = str(e.get("id", "")).strip()
        hedef_klasor = str(e.get("hedef_klasor", "")).strip()
        goreli_yol = id_yol_eslemesi.get(gid)
        if not goreli_yol or not hedef_klasor:
            continue
        kaynak = klasor_p / goreli_yol
        hedef = klasor_p / hedef_klasor / Path(goreli_yol).name
        items.append({
            "id": gid,
            "source": str(kaynak),
            "destination": str(hedef),
            "reason": f"'{hedef_klasor}' klasörüne uygun görüldü",
        })

    if not items:
        return {"bos": True, "plan_id": None, "aciklama": "İsteğinize uyan görsel bulunamadı.", "items": []}

    plan_id = str(uuid.uuid4())
    _plan_store[plan_id] = {"klasor": klasor, "items": items}

    return {
        "bos": False,
        "plan_id": plan_id,
        "aciklama": f"{len(items)} görsel, isteğinize göre sınıflandırıldı.",
        "items": items,
    }


def web_execute(plan_id: str, approved_ids: list[str]):
    plan = _plan_store.get(plan_id)
    if not plan:
        return {"basarili": [], "hatalar": ["Plan bulunamadı, süresi dolmuş olabilir."]}

    onayli_set = set(approved_ids)
    basarili, hatalar, tasinanlar = [], [], []

    for item in plan["items"]:
        if item["id"] not in onayli_set:
            continue
        kaynak = Path(item["source"])
        hedef = Path(item["destination"])
        try:
            hedef.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(kaynak), str(hedef))
            basarili.append(item["id"])
            tasinanlar.append({"source": str(kaynak), "destination": str(hedef)})
        except OSError as e:
            hatalar.append(f"{kaynak.name}: {e}")

    session_id = str(uuid.uuid4())
    if tasinanlar:
        (_oturum_dizini / f"{session_id}.json").write_text(
            json.dumps({"klasor": plan["klasor"], "tasinanlar": tasinanlar}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    return {"uygulanan": len(basarili), "basarili": basarili, "hatalar": hatalar, "session_id": session_id}


def web_rollback(klasor: str, session_id: str):
    oturum_dosyasi = _oturum_dizini / f"{session_id}.json"
    if not oturum_dosyasi.exists():
        return {"basarili": False, "hatalar": ["Oturum kaydı bulunamadı."], "mesaj": "Oturum kaydı bulunamadı."}

    veri = json.loads(oturum_dosyasi.read_text(encoding="utf-8"))
    hatalar = []
    for tasinan in veri.get("tasinanlar", []):
        kaynak = Path(tasinan["source"])
        hedef = Path(tasinan["destination"])
        try:
            kaynak.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(hedef), str(kaynak))
        except OSError as e:
            hatalar.append(f"{hedef.name}: {e}")

    oturum_dosyasi.unlink(missing_ok=True)
    if hatalar:
        return {"basarili": False, "hatalar": hatalar, "mesaj": "Bazı dosyalar geri taşınamadı: " + "; ".join(hatalar)}
    return {"basarili": True, "hatalar": [], "mesaj": "Tüm görseller eski konumlarına geri taşındı."}
