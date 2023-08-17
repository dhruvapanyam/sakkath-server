const jwt = require("jsonwebtoken");
const config = require("../config/auth.config");
const User = require("../models/users");

verifyToken = (req, res, next) => {
    let token = req.body.token || req.header('x-auth-token');

    if (!token) {
        return res.status(400).json({
        message: "No token provided!",
        });
    }

    console.log('verifying token')
    jwt.verify(
        token,
        config.secret,
        (err, decoded) => {
            if (err) {
                // console.log('err auth token',err.name)
                return res.status(400).json({
                    token_err: true,
                    expired: err.name == 'TokenExpiredError',  
                    message: "Unauthorized!",
                });
            }
            req.user_id = decoded.id;
            next();
        }
    );
};

isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user_id);

    
    if (user.role === "admin") {
        return next();
    }

    return res.status(400).json({
      message: "Requires admin role!",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to validate user admin clearance!",
    });
  }
};

isCaptain = async (req, res, next) => {
    try {
      const user = await User.findById(req.user_id);
  
      
      if (user.role === "team") {
          return next();
      }
  
      return res.status(400).json({
        message: "Require Admin Role!",
      });
    } catch (error) {
      return res.status(500).json({
        message: "Unable to validate User role!",
      });
    }
  };

const authJwt = {
  verifyToken,
  isAdmin,
  isCaptain
};
module.exports = authJwt;