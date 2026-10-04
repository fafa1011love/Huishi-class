#!/usr/bin/env python3
"""把本地 dist 差异上传到服务器（不在服务器上构建，避免 CPU 打满）。

用法：
    python scripts/deploy_push_dist.py            # 只算差异，不上传（dry run）
    python scripts/deploy_push_dist.py --apply    # 真正上传并切换

设计要点（服务器 2 核 / 1.9G，构建必炸）：
    1. 前端产物在本机构建，服务器只接收文件，完全不跑 npm/vite
    2. 按 文件名+大小 做差异比对，只传变化的文件
    3. 先传静态资源，最后才覆盖 index.html —— 切换是原子的，中途访问不受影响
    4. 传完 chown www:www，nginx reload；全程不产生 CPU 密集操作
"""
import json
import os
import sys
import time
import warnings

warnings.filterwarnings('ignore')
import paramiko

HOST = os.environ.get('SSH_HOST', '64.90.3.51')
USER = os.environ.get('SSH_USER', 'root')
PASS = os.environ.get('SSH_PASS', '')
if APPLY and not PASS:
    sys.exit('请先设置环境变量 SSH_PASS（SSH_HOST / SSH_USER 有默认值）')
APP_DIR = '/www/wwwroot/shuzhi'
LOCAL_DIST = r'C:\Users\yuyiling\Desktop\shuzhi\dist'
REMOTE_LIST = r'C:\Users\yuyiling\Desktop\shuzhi\scripts\_tmp_remote_dist.json'

APPLY = '--apply' in sys.argv


def walk_local():
    """返回 {相对路径: (绝对路径, 大小)}"""
    out = {}
    for root, _, files in os.walk(LOCAL_DIST):
        for name in files:
            abs_p = os.path.join(root, name)
            rel = os.path.relpath(abs_p, LOCAL_DIST).replace('\\', '/')
            out[rel] = (abs_p, os.path.getsize(abs_p))
    return out


def main():
    remote = json.load(open(REMOTE_LIST, encoding='utf-8'))
    local = walk_local()

    to_upload = []
    for rel, (abs_p, size) in sorted(local.items()):
        rkey = f'dist/{rel}'
        # 大文件按大小比对；小文件一律覆盖（成本可忽略，避免"大小恰好相同但内容变了"）
        if rkey not in remote or remote[rkey] != size or size < 200 * 1024:
            to_upload.append((rel, abs_p, size))

    total = sum(s for _, _, s in to_upload)
    print(f'本地 dist: {len(local)} 个文件')
    print(f'服务器 dist: {len(remote)} 个文件')
    print(f'需上传: {len(to_upload)} 个文件，共 {total / 1024 / 1024:.2f} MB\n')
    for rel, _, size in to_upload:
        print(f'  {size:>10,}  {rel}')

    if not APPLY:
        print('\n[dry-run] 未上传。加 --apply 执行。')
        return

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=30, banner_timeout=60, auth_timeout=30)
    sftp = c.open_sftp()

    # index.html 放最后传，保证切换原子
    ordered = [x for x in to_upload if x[0] != 'index.html'] + \
              [x for x in to_upload if x[0] == 'index.html']

    ok = 0
    for rel, abs_p, size in ordered:
        target = f'{APP_DIR}/dist/{rel}'
        parent = target.rsplit('/', 1)[0]
        try:
            sftp.stat(parent)
        except IOError:
            sftp.mkdir(parent)
        sftp.put(abs_p, target)
        ok += 1
        print(f'[上传 {ok}/{len(ordered)}] {rel} ({size:,} B)')
        if size > 2 * 1024 * 1024:
            time.sleep(0.5)  # 大文件之间留一点余量，避免 IO/加密瞬间打高

    sftp.close()

    def run(cmd, timeout=180):
        _, out, _ = c.exec_command(cmd, get_pty=True, timeout=timeout)
        return out.read().decode('utf-8', 'replace')

    print('\n=== 修正属主 + 校验 nginx ===')
    print(run(f'cd {APP_DIR} && chown -R www:www dist && nginx -t 2>&1'))

    print('\n=== 清理上一版残留资源 ===')
    old = ['index-Dnkis9kK.js', 'index-Op6f9c_8.css']
    print(run(f'cd {APP_DIR}/dist/assets && rm -f {" ".join(old)} && ls -l | grep -E "index-.*\\.(js|css)"'))

    print('\n=== 重载 nginx + 重启 API ===')
    print(run('nginx -s reload && echo "nginx reloaded"'))
    print(run('pm2 restart shuzhi 2>&1 | tail -2 && sleep 3 && pm2 list | grep shuzhi'))

    print('\n=== 冒烟 ===')
    print(run(
        "echo -n '首页: '; curl -s -o /dev/null -w '%{http_code}\\n' "
        "--resolve shuzhiclass.com:443:127.0.0.1 https://shuzhiclass.com/; "
        "echo -n 'API:  '; curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:4001/api/auth/me; "
        "echo -n 'favicon: '; curl -s -o /dev/null -w '%{http_code}\\n' "
        "--resolve shuzhiclass.com:443:127.0.0.1 https://shuzhiclass.com/favicon.ico"))
    print(run('curl -s --resolve shuzhiclass.com:443:127.0.0.1 https://shuzhiclass.com/ '
              '| grep -oE "/assets/index-[A-Za-z0-9_-]+\\.(js|css)" | sort -u'))

    print('\n=== 负载（确认未打高） ===')
    print(run('cat /proc/loadavg; ps -eo pcpu,pmem,comm --sort=-pcpu | head -5'))
    c.close()
    print('\n[完成] 部署结束')


if __name__ == '__main__':
    main()
