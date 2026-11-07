#!/usr/bin/env python3
"""把本地 .env.local 的 HUNYUAN3D_* 四个键同步到服务器 /etc/shuzhi-prep.env（幂等）。
密钥只经内存传递，不打印完整值。"""
import os
import re

import paramiko

LOCAL_ENV = r'C:\Users\yuyiling\Desktop\shuzhi\.env.local'
KEYS = ['HUNYUAN3D_BASE_URL', 'HUNYUAN3D_API_KEY', 'HUNYUAN3D_MODEL', 'HUNYUAN3D_EXPRESS_API_KEY']
ENV_FILE = '/etc/shuzhi-prep.env'

# 1. 读本地值
values = {}
for line in open(LOCAL_ENV, encoding='utf-8'):
    m = re.match(r'^(HUNYUAN3D_[A-Z_]+)=(.*)$', line.strip())
    if m and m.group(1) in KEYS:
        values[m.group(1)] = m.group(2).strip().strip('"\'')
missing = [k for k in KEYS if k not in values]
if missing:
    raise SystemExit(f'本地 .env.local 缺少: {missing}')
print('已从本地读取:', ', '.join(f'{k}={v[:6]}***({len(v)}字符)' for k, v in values.items()))

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('64.90.3.51', username='root', password=os.environ.get('SSH_PASS', ''),
               timeout=30, banner_timeout=60, auth_timeout=30)


def run(cmd, timeout=120):
    _, out, _ = client.exec_command(cmd, get_pty=True, timeout=timeout)
    return out.read().decode('utf-8', 'replace').strip()


stamp = run('date +%Y%m%d_%H%M%S')
print(run(f'cp -p {ENV_FILE} {ENV_FILE}.bak_{stamp} && echo "已备份 {ENV_FILE}.bak_{stamp}"'))

# 2. 用 sftp 重写文件：保留其它行，替换/追加 HUNYUAN3D 键
sftp = client.open_sftp()
with sftp.open(ENV_FILE, 'r') as fh:
    lines = fh.read().decode('utf-8').splitlines()
out_lines, seen = [], set()
for line in lines:
    key = line.split('=', 1)[0].strip()
    if key in KEYS:
        if key not in seen:
            out_lines.append(f'{key}={values[key]}')
            seen.add(key)
        continue
    out_lines.append(line)
for key in KEYS:
    if key not in seen:
        out_lines.append(f'{key}={values[key]}')
tmp = ENV_FILE + '.tmp'
with sftp.open(tmp, 'w') as fh:
    fh.write(('\n'.join(out_lines) + '\n').encode('utf-8'))
sftp.close()
print(run(f'chown root:root {tmp} && chmod 600 {tmp} && mv {tmp} {ENV_FILE} && echo "写入完成"'))

print('\n=== 修改后（键名 + 值脱敏） ===')
print(run(f"sed -E 's/^(HUNYUAN3D_[A-Z_]+)=(.{{6}}).*/\\1=\\2***/' {ENV_FILE}"))

print('\n=== 重启备课服务 ===')
print(run('systemctl restart shuzhi-prep && sleep 3 && systemctl is-active shuzhi-prep'))

print('\n=== 验证 3d/status ===')
print(run('curl -s -m 5 http://127.0.0.1:8765/api/3d/status'))
client.close()
