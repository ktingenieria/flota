import jwt from 'jsonwebtoken';
export const auth = (roles = []) => (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({message:'No token'});
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    if (roles.length && !roles.includes(payload.rol)) {
      return res.status(403).json({message:'No autorizado'});
    }
    next();
  } catch (e) {
    return res.status(401).json({message:'Token inválido'});
  }
};
