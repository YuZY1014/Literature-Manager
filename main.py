import os, webbrowser, threading
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from config import STATIC_DIR

app = FastAPI(title="文献管理系统", version="1.0")

from database import Base, engine
from models import Document, Tag, Annotation, Attachment
Base.metadata.create_all(bind=engine)

from routers import documents, tags, annotations, attachments, import_api
app.include_router(documents.router)
app.include_router(tags.router)
app.include_router(annotations.router)
app.include_router(attachments.router)
app.include_router(import_api.router)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def root():
    from fastapi.responses import FileResponse
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


def start():
    def open_browser():
        webbrowser.open("http://127.0.0.1:8088")
    threading.Timer(1.0, open_browser).start()
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8088, reload=False)


if __name__ == "__main__":
    start()
