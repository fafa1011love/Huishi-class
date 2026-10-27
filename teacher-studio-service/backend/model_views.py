"""Content-addressed, atomic standard views of the exact exported GLB."""
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

from PIL import Image
import biomed_models

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'generated' / 'model-views'
# 视图分辨率：1024 在这台 2 核服务器上渲 4 张会超过 300 秒而失败，默认用 512。
RESOLUTION = int(os.environ.get('MODEL_VIEW_RESOLUTION', '512'))
# 四视图渲染总开关。实测：Blender 渲染混元产出的高质量模型，在 700M 限制下 8.9 秒就被
# OOM kill，而整机可用内存只有约 1G——这台服务器根本渲不动。因此默认关闭渲染，
# 模型本身照常生成；将来升配或换轻量渲染方案后设 MODEL_VIEW_RENDER=1 即可恢复。
RENDER_ENABLED = os.environ.get('MODEL_VIEW_RENDER', '0').strip().lower() in ('1', 'true', 'yes', 'on')
# 版本号带上分辨率，改分辨率后旧缓存自动失效重渲。
VERSION = f'orthographic-{RESOLUTION}-v1'
VIEWS = ('front', 'left', 'right', 'back')
_locks = {}
_guard = threading.Lock()


def fingerprint(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def validate_image(path):
    with Image.open(path) as image:
        image.load()
        if image.size != (RESOLUTION, RESOLUTION):
            raise ValueError('视图尺寸不正确')
        alpha = image.convert('RGBA').getchannel('A')
        bounds = alpha.getbbox()
        if not bounds or bounds[0] <= 0 or bounds[1] <= 0 or bounds[2] >= RESOLUTION or bounds[3] >= RESOLUTION:
            raise ValueError('模型截图为空或超出画面')


def _cached(directory, digest):
    try:
        record = json.loads((directory / 'views.json').read_text(encoding='utf-8'))
        if record['viewModelFingerprint'] != digest or record['viewRenderVersion'] != VERSION:
            return None
        for key in VIEWS:
            path = directory / record['files'][key]
            if path.parent != directory or fingerprint(path) != record['hashes'][key]:
                return None
            validate_image(path)
        return record
    except (OSError, ValueError, KeyError, TypeError):
        return None


def _render(model_path, destination):
    blender = biomed_models.find_blender()
    if not blender:
        raise RuntimeError('无法生成模型四视图：未找到 Blender。模型已保留，恢复渲染服务后可重试。')
    try:
        result = subprocess.run([str(blender), '--background', '--factory-startup', '--python-exit-code', '1',
                                 '--python', str(Path(__file__).with_name('render_model_views.py')),
                                 '--', str(model_path), str(destination)],
                                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError('模型四视图生成超过 300 秒，模型已保留，请重试。') from exc
    if result.returncode:
        log = CACHE / (destination.name + '.log')
        log.write_text(result.stdout + '\n' + result.stderr, encoding='utf-8')
        raise RuntimeError('模型四视图渲染失败，模型已保留，请重试。日志：' + log.name)


def ensure_views(model_path, render=True):
    if not RENDER_ENABLED:
        # 渲染总开关关闭：直接告知调用方"未启用"，绝不启动 Blender。
        return {'status': 'disabled', 'viewImageUrls': {}, 'viewRenderVersion': VERSION}
    model_path = Path(model_path)
    digest = fingerprint(model_path)
    directory = CACHE / (VERSION + '-' + digest)
    with _guard:
        lock = _locks.setdefault(str(directory), threading.Lock())
    if not lock.acquire(timeout=310):
        raise RuntimeError('模型图片仍在生成，请稍后重试。')
    try:
        record = _cached(directory, digest)
        if record is None and not render:
            return {'status': 'missing', 'viewModelFingerprint': digest, 'viewRenderVersion': VERSION}
        if record is None:
            directory.mkdir(parents=True, exist_ok=True)
            temporary = Path(tempfile.mkdtemp(prefix='render-', dir=CACHE))
            try:
                # Snapshot the model so a concurrent replacement cannot mix views.
                snapshot = temporary / 'source.glb'
                shutil.copyfile(model_path, snapshot)
                if fingerprint(snapshot) != digest:
                    raise RuntimeError('模型在截图前发生变化，请重试。')
                _render(snapshot, temporary)
                for key in VIEWS:
                    validate_image(temporary / (key + '.png'))
                files = {key: temporary.name + '-' + key + '.png' for key in VIEWS}
                hashes = {key: fingerprint(temporary / (key + '.png')) for key in VIEWS}
                for key in VIEWS:
                    shutil.move(str(temporary / (key + '.png')), directory / files[key])
                record = {'viewModelFingerprint': digest, 'viewRenderVersion': VERSION, 'files': files, 'hashes': hashes}
                staging = directory / 'views.pending.json'
                staging.write_text(json.dumps(record), encoding='utf-8')
                staging.replace(directory / 'views.json')
            finally:
                shutil.rmtree(temporary)
        urls = {key: '/api/3d/preview/model-views/' + directory.name + '/' + record['files'][key] for key in VIEWS}
        return {'status': 'ready', 'viewImageUrls': urls, 'viewModelFingerprint': digest,
                'viewRenderVersion': VERSION, 'viewImageSource': 'model-rendered-standard-views'}
    finally:
        lock.release()
