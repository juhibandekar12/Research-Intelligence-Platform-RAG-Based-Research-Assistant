import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        # Login
        r = await client.post('http://localhost:8000/api/auth/login', json={'email': 'juhi_live_test@gmail.com', 'password': 'password123'})
        print("LOGIN:", r.status_code)
        token = r.json()['access_token']
        
        # Test PDF upload
        pdf_path = r"uploads\8fcc9176-6753-4e68-8fee-83729fa6804a\1b640078-5a31-41a2-86e1-8101ff416e18.pdf"
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()

        files = {'file': ('atiaun.pdf', pdf_bytes, 'application/pdf')}
        data = {'doc_type': 'paper', 'title': 'atiaun'}

        upload_res = await client.post(
            'http://localhost:8000/api/documents/upload',
            headers={'Authorization': f'Bearer {token}'},
            files=files,
            data=data
        )
        print("STATUS:", upload_res.status_code)
        print("RESPONSE TEXT:", upload_res.text)

if __name__ == "__main__":
    asyncio.run(test())
