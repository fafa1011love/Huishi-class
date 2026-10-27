#!/usr/bin/env python3
"""部署后验证（只读）。"""
import os

import paramiko

HOST = '64.90.3.51'
USER = 'root'
PASS = os.environ.get('SSH_PASS', '')
APP_DIR = '/www/wwwroot/shuzhi'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30, banner_timeout=60, auth_timeout=30)


def run(cmd, timeout=120):
    _, out, _ = client.exec_command(cmd, get_pty=True, timeout=timeout)
    return out.read().decode('utf-8', 'replace').strip()


print('=== 1. 备课服务状态 ===')
print(run('systemctl status shuzhi-prep --no-pager | head -5'))
print(run('systemctl show shuzhi-prep -p ActiveState -p SubState -p MemoryMax -p CPUQuota'))

print('\n=== 2. 备课服务日志（找 ImportError / Traceback） ===')
print(run('journalctl -u shuzhi-prep -n 30 --no-pager'))
print('\n-- 错误过滤 --')
print(run("journalctl -u shuzhi-prep -n 200 --no-pager | grep -iE 'traceback|importerror|modulenotfound|error' | tail -15 || echo '(无错误行)'"))

print('\n=== 3. pm2 日志 ===')
print(run('pm2 logs shuzhi --lines 25 --nostream 2>&1'))

print('\n=== 4. 直连备课服务（8765） ===')
print(run('curl -s -m 5 http://127.0.0.1:8765/api/lesson-ai/status'))
print(run('curl -s -m 5 http://127.0.0.1:8765/api/3d/status'))

print('\n=== 5. 经 nginx + Node 代理的链路（前端实际走的） ===')
print(run("curl -s -m 10 --resolve shuzhiclass.com:443:127.0.0.1 https://shuzhiclass.com/api/prep/lesson-ai/status"))
print(run("echo -n 'prep/lesson-ai/status HTTP: '; curl -s -o /dev/null -w '%{http_code}\\n' -m 10 "
          "--resolve shuzhiclass.com:443:127.0.0.1 https://shuzhiclass.com/api/prep/lesson-ai/status"))
print(run("echo -n '旧接口 local-model/status HTTP: '; curl -s -o /dev/null -w '%{http_code}\\n' -m 10 "
          "--resolve shuzhiclass.com:443:127.0.0.1 https://shuzhiclass.com/api/prep/local-model/status"))

print('\n=== 6. dist/index 资源与属主 ===')
print(run(f'ls -l {APP_DIR}/dist/assets/ | grep -E "index-.*\\.(js|css)"'))
print(run(f'ls -ld {APP_DIR}/dist {APP_DIR}/server {APP_DIR}/teacher-studio-service/backend'))
print(run(f'find {APP_DIR}/dist {APP_DIR}/server {APP_DIR}/teacher-studio-service/backend '
          f'! -user www | head -10 || true'))

print('\n=== 7. 备份目录 ===')
print(run(f'ls -l {APP_DIR}/teacher-studio-service/backend/.bak_* -d 2>/dev/null'))
print(run(f'ls {APP_DIR}/teacher-studio-service/backend/.bak_20261016_180316 2>/dev/null'))

print('\n=== 8. 负载 / 内存 ===')
print(run('cat /proc/loadavg; free -m | head -2'))
client.close()
