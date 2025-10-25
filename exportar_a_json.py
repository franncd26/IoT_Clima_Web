# exportar_a_json.py
# Exporta Datastore -> JSON estático (para GitHub Pages)
import os, json
from datetime import datetime
from google.cloud import datastore

# === Config local (ajusta la ruta a tu JSON) ===
PROJECT_ID = "iotproject-3d43c"
GOOGLE_APPLICATION_CREDENTIALS = r"C:\Users\franc\PycharmProject\ParaArqui\IoT_Project\iotproject-3d43c-firebase-adminsdk-fbsvc-78234fa09d.json"

# Carpeta de la web (GitHub Pages suele ser /docs)
OUT_DIR = os.path.join(os.getcwd(), "docs")
os.makedirs(OUT_DIR, exist_ok=True)

def isoify(v):
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v

def entity_to_dict(e):
    d = {k: isoify(e.get(k)) for k in e.keys()}
    d["doc_id"] = e.key.name
    return d

def dump_kind(client, kind, sort_key):
    q = client.query(kind=kind)
    q_iter = list(q.fetch())
    items = [entity_to_dict(e) for e in q_iter]
    items.sort(key=lambda x: x.get(sort_key, ""))
    return {"items": items, "count": len(items)}

def main():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GOOGLE_APPLICATION_CREDENTIALS
    client = datastore.Client(project=PROJECT_ID)

    print("Exportando Lectura...")
    lecturas = dump_kind(client, "Lectura", "doc_id")         # YYYYMMDD_HHMM
    with open(os.path.join(OUT_DIR, "lecturas.json"), "w", encoding="utf-8") as f:
        json.dump(lecturas, f, ensure_ascii=False)

    print("Exportando AggHora...")
    agg_hora = dump_kind(client, "AggHora", "doc_id")          # YYYYMMDD_HH
    with open(os.path.join(OUT_DIR, "agg_hora.json"), "w", encoding="utf-8") as f:
        json.dump(agg_hora, f, ensure_ascii=False)

    print("Exportando AggDia...")
    agg_dia = dump_kind(client, "AggDia", "doc_id")            # YYYYMMDD
    with open(os.path.join(OUT_DIR, "agg_dia.json"), "w", encoding="utf-8") as f:
        json.dump(agg_dia, f, ensure_ascii=False)

    print("✅ Listo. Archivos en /docs: lecturas.json, agg_hora.json, agg_dia.json")

if __name__ == "__main__":
    main()
