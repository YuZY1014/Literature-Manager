import os
import sys

if getattr(sys, 'frozen', False):
    # PyInstaller 打包环境
    BASE_DIR = os.path.dirname(sys.executable)       # exe 所在目录（数据存储位置）
    STATIC_DIR = os.path.join(sys._MEIPASS, 'static')  # 打包内部的静态文件
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    STATIC_DIR = os.path.join(BASE_DIR, 'static')

DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'data', 'literature.db')}"
PAPERS_DIR = os.path.join(BASE_DIR, "papers")
ATTACHMENTS_DIR = os.path.join(BASE_DIR, "attachments")

os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)
os.makedirs(PAPERS_DIR, exist_ok=True)
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)
