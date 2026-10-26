"""Isolated local Marker bridge. Reads a local image/PDF; never uploads it.

Marker 1.10.1 has GPL code and separately licensed model weights. This optional
runtime is kept outside the web app bundle. Review its exact license before
redistributing or commercial deployment.
"""
import os
import sys
import json
import ssl
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('HF_HOME', str(ROOT / 'data/ocr-models'))
os.environ.setdefault('MODEL_CACHE_DIR', str(ROOT / 'data/ocr-models'))
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
os.environ.setdefault('TORCH_DEVICE', 'cpu')
os.environ.setdefault('OMP_NUM_THREADS', '4')

# Keep TLS verification enabled and include the Windows trust store.
if sys.platform == 'win32':
    import certifi
    bundle = ROOT / 'data/ocr-runtime/system-ca.pem'
    certs = Path(certifi.where()).read_text(encoding='ascii')
    for store in ('ROOT', 'CA'):
        for cert, encoding, trust in ssl.enum_certificates(store):
            if encoding == 'x509_asn':
                certs += ssl.DER_cert_to_PEM_cert(cert)
    bundle.write_text(certs, encoding='ascii')
    os.environ['REQUESTS_CA_BUNDLE'] = str(bundle)
    os.environ['SSL_CERT_FILE'] = str(bundle)

if __name__ == '__main__':
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict
    from marker.output import text_from_rendered
    from marker.config.parser import ConfigParser
    source, destination = sys.argv[1:3]
    config = ConfigParser({'force_ocr': True, 'disable_multiprocessing': True, 'output_format': 'markdown'})
    converter = PdfConverter(config=config.generate_config_dict(), artifact_dict=create_model_dict(),
                             processor_list=config.get_processors(), renderer=config.get_renderer())
    rendered = converter(source)
    text, _, images = text_from_rendered(rendered)
    # Preserve extracted diagrams instead of replacing them with descriptions.
    import base64
    import io
    pictures = []
    for name, image in images.items():
        data = io.BytesIO()
        image.save(data, format='PNG')
        pictures.append({'name': name, 'data': base64.b64encode(data.getvalue()).decode('ascii')})
    Path(destination).write_text(json.dumps({'text': text, 'images': pictures}, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'characters': len(text), 'images': len(pictures)}))
