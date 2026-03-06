const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function requireDeviceAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ message: 'No device token' })

  const token = auth.split(' ')[1]

  const display = await prisma.display.findUnique({
    where: { deviceToken: token },
  })

  if (!display) {
    return res.status(401).json({ message: 'Invalid device token' })
  }

  req.display = display
  next()
}

module.exports = { requireDeviceAuth }
