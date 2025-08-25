import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { JWT_SECRET } from '../config/config';
import { TokenPayload } from '../types/auth.types';
import { UnauthorizedError } from '../utils/errors';
import { AuthService } from '../services/auth.service';

interface AuthMiddlewareOptions {
  accessTokenFirst?: boolean; // true -> access-first, false -> refresh-first (default)
}

export const authMiddleware = (options: AuthMiddlewareOptions = {}) => {
  const { accessTokenFirst = false } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { accessToken, refreshToken } = req.cookies;

    const verifyToken = (token: string): TokenPayload =>
      jwt.verify(token, JWT_SECRET) as TokenPayload;

    const generateNewAccess = (decoded: TokenPayload): void => {
      const newToken = new AuthService().generateToken(
        {
          tokenName: 'access',
          _id: decoded._id,
          email: decoded.email,
          role: decoded.role,
          gardenId: decoded.gardenId,
        },
        parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '900', 10)
      );
      res.cookie('accessToken', newToken, {
        httpOnly: true,
        secure: false,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge: Number(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN)
          ? Number(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN)
          : 1000 * 60 * 60 * 24 * 365,
      });
    };

    try {
      if (accessTokenFirst) {
        // ---------- ACCESS-FIRST LOGIC ----------
        if (!accessToken) throw new UnauthorizedError('Access token missing');

        try {
          req.user = verifyToken(accessToken);
          return next();
        } catch (err) {
          if (err instanceof TokenExpiredError) {
            if (!refreshToken) throw new UnauthorizedError('Refresh token missing');
            const decodedRefresh = verifyToken(refreshToken);
            generateNewAccess(decodedRefresh);
            req.user = decodedRefresh;
            return next();
          }
          throw new UnauthorizedError('Invalid access token');
        }
      } else {
        // ---------- REFRESH-FIRST LOGIC ----------
        if (!refreshToken) throw new UnauthorizedError('Refresh token missing');

        const decodedRefresh = verifyToken(refreshToken);

        if (accessToken) {
          try {
            verifyToken(accessToken);
          } catch (err) {
            if (err instanceof TokenExpiredError) generateNewAccess(decodedRefresh);
            else throw new UnauthorizedError('Invalid access token');
          }
        } else {
          generateNewAccess(decodedRefresh);
        }

        req.user = decodedRefresh;
        return next();
      }
    } catch (err) {
      return next(err instanceof UnauthorizedError ? err : new UnauthorizedError('Unauthorized'));
    }
  };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
