#!/usr/bin/env python3
"""把 LESSON_AI_API_KEY 写入服务器 /etc/shuzhi-prep.env（幂等：已存在则替换，否则追加）。"""
import os
import sys

import paramiko

HOST = '64.90.3.51'
USER = 'root'
PASS = os.environ.get('SSH_PASS', '')
KEY = os.environ.get('LESSON_AI_API_KEY', '')
if not KEY:
    sys.exit('缺少环境变量 LESSON_AI_API_KEY')

ENV_FILE = '/etc/shuzhi-prep.env'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30, banner_timeout=60, auth_timeout=30)


def run(cmd, timeout=120):
    _, out, err = client.exec_command(cmd, get_pty=True, timeout=timeout)
    text = out.read().decode('utf-8', 'replace')
    return text.strip()


print('=== 修改前 ===')
print(run(f'ls -l {ENV_FILE}; cat {ENV_FILE}'))

# 备份
stamp = run('date +%Y%m%d_%H%M%S')
print(run(f'cp -p {ENV_FILE} {ENV_FILE}.bak_{stamp} && echo "已备份 {ENV_FILE}.bak_{stamp}"'))

# 先删旧行，再追加新行（保证幂等）
script = (
    f"grep -v '^LESSON_AI_API_KEY=' {ENV_FILE} > {ENV_FILE}.tmp && "
    f"printf 'LESSON_AI_API_KEY=%s\\n' '{KEY}' >> {ENV_FILE}.tmp && "
    f"mv {ENV_FILE}.tmp {ENV_FILE} && chmod 600 {ENV_FILE} && chown root:root {ENV_FILE}"
)
print(run(script))

print('\n=== 修改后（值已脱敏） ===')
print(run(f"sed 's/^LESSON_AI_API_KEY=.*/LESSON_AI_API_KEY=sk-***<已设置>/' {ENV_FILE}"))
print(run(f"grep -c '^LESSON_AI_API_KEY=' {ENV_FILE}"))
client.close()
print('\n[完成] 密钥已写入，仍需重启 shuzhi-prep 生效')
