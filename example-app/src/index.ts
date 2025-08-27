import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/webhook/:integration', async (c) => {
  switch (c.req.param('integration')) {
    case 'upstash':
      const stripeBody = await c.req.json() 
      console.log(stripeBody)
      return c.json({
        message: 'Hello Stripe!'
      })
    case 'stripe':
      const shopifyBody = await c.req.json()
      console.log(shopifyBody)
      return c.json({
        message: 'Hello Shopify!'
      })
    default:
      return c.text('Hello Hono!')
  }
})


export default app
