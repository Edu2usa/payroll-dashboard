import { NextRequest } from 'next/server'
import { POST } from '@/app/api/reviews/route'
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await request.json()
  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ ...body, id: params.id }),
    }),
  )
}
