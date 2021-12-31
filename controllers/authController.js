const Joi = require("joi");
const jwt = require("jsonwebtoken");
const router = require("express").Router();
const bcrypt = require("bcrypt");

const validateWith = require("../middleware/validation");
const db = require("../models");
const { date } = require("joi");
const Login = db.login;

const schema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required().min(5),
});

router.post("/", validateWith(schema), async (req, res) => {
  const { email, password } = req.body;

  const user = await Login.findOne({ where: { email: email } });
  if (!user)
    return res.status(400).send({ error: "Invalid email or password." });

  bcrypt.compare(password, user.password, async (err, result) => {
    if (result === false)
      return res.status(400).send({ error: "Invalid email or password." });

    //Update last login
    user.set({
      lastLogin: Date.now(),
      status: "online",
    });

    await user.save();

    const token = jwt.sign(
      { userId: user.id, name: user.name, email },
      "jwtPrivateKey"
    );
    const response = {
      user: {
        id: user.id,
        name: user.name,
        email,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken: token,
      tokenType: "x-access-token",
    };
    res.send(response);
  });
});

module.exports = router;
