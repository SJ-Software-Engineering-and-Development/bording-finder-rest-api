const Joi = require("joi");
const validateWith = require("../middleware/validation");
const router = require("express").Router();
const bcrypt = require("bcrypt");
const verifyToken = require("../middleware/verifyToken");
const nodemailer = require("nodemailer");
const querystring = require("querystring");
const multer = require("multer");
const fs = require("fs");

const ROLE = require("../config/roleEnum");
const imgHelper = require("../helpers/imageFilter");
const imgStorage = require("../storageConfig");

const db = require("../models");
const Login = db.login;
const UserProfile = db.userProfile;

const schema = Joi.object({
  fullName: Joi.string().required(),
  address: Joi.string().required(),
  phone: Joi.string().required(),
  occupation: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(4),
  avatar: Joi.any(),
});

const signOutSchema = Joi.object({
  email: Joi.string().email().required(),
});

router.post(
  "/signout",
  verifyToken,
  validateWith(signOutSchema),
  async (req, res) => {
    const { email } = req.body;
    const user = await Login.findOne({ where: { email: email } });
    if (user) {
      //Update status,lastLogin
      user.set({
        lastLogin: Date.now(),
        status: "offline",
      });
      await user.save();
      return res.status(200).send({ data: `${email} Signed out` });
    }
    /*
    cannot manually expire a token after it has been created.
    Thus, you cannot log out with JWT on the server-side as you do with sessions.
    JWT is stateless, meaning that you should store everything you need in the payload
    and skip performing a DB query on every request.
    */
    return res
      .status(400)
      .send({ error: "A user with the given email not exists." });
  }
);

router.get("/", verifyToken, async (req, res) => {
  const users = await Login.findAll({
    attributes: ["id", "name", "email", "role", "status"],
  });
  if (!users) return res.status(400).send({ error: "No users found." });

  //Simulate slow N/W
  setTimeout(() => {
    res.status(200).send(users);
  }, 2000);
});

// router.get("/getProfiles", async (req, res) => {
//   const users = await ModelName.findAll({
//     include: [
//       {
//         association: ModelName.userProfile,
//         include: [Login],
//       },
//     ],
//   });
//   if (!users) return res.status(400).send({ error: "No users found." });

//   res.status(200).send(users);
// });

router.post("/signup/:role", async (req, res) => {
  const role = req.params.role;
  let newUser = {};

  const upload = multer({
    storage: imgStorage.storage,
    limits: { fileSize: 1024 * 1024 * 5 },
    fileFilter: imgHelper.imageFilter,
  }).single("avatar");

  upload(req, res, async function (err) {
    // req.file contains information of uploaded file
    // req.body contains information of text fields, if there were any

    let imageFile = "uploads\\userempty.png"; //req.file.path;

    if (req.fileValidationError) {
      //  return res.status(400).send({ error: req.fileValidationError });
    } else if (!req.file) {
      //   return res
      //     .status(400)
      //     .send({ error: "Please select an image to upload" });
    } else if (err instanceof multer.MulterError) {
      //  return res.status(400).send({ error: err });
    } else if (err) {
      //  return res.status(400).send({ error: err });
    } else {
      imageFile = req.file.path;
    }

    const { error, value } = schema.validate({
      fullName: req.body.fullName,
      address: req.body.address,
      phone: req.body.phone,
      occupation: req.body.occupation,
      email: req.body.email,
      password: req.body.password,
    });
    if (error) return res.status(400).send({ error: error.details[0].message });

    const fullName = req.body.fullName;
    const address = req.body.address;
    const phone = req.body.phone;
    const occupation = req.body.occupation;
    const email = req.body.email;
    const password = req.body.password;

    const oldUser = await Login.findOne({
      where: { email: email },
    });
    if (oldUser) {
      //Remove uploaded file from ./uploads folder
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error(err);
        }
        //file removed success
      });
      return res
        .status(400)
        .send({ error: "A user with the given email already exists." });
    }

    //store in Db

    encryptedPassword = await bcrypt.hash(password, 5);
    let uData = {
      userProfile: {
        fullName: fullName,
        address: address,
        phone: phone,
        occupation: occupation,
        login: {
          name: fullName,
          email: email,
          password: encryptedPassword,
          avatar: imageFile,
        },
      },
    };

    switch (role) {
      case ROLE.Client:
        uData.userProfile.login.role = ROLE.Client;
        break;
      case ROLE.Accommodater:
        uData.userProfile.login.role = ROLE.Client;
        break;
      default:
        return res.status(400).send({ error: "Error! Invalid user type" });
    }

    //status , lastLogin has default values no need to set here
    //Create user
    newUser = await UserProfile.create(uData.userProfile, {
      include: [Login],
    });

    if (!newUser)
      return res
        .status(400)
        .send({ error: "Error! Server having some trubles" });

    return res.status(200).send({
      data: `${uData.userProfile.login.email} has been registered as a ${role}`,
    });
    /* Simulate slow N/W
  setTimeout(() => {
    
  }, 1000);
  */
  });
});

router.get("/get", async (req, res) => {
  const users = await UserProfile.findAll({
    include: {
      model: Login,
      attributes: { exclude: ["password", "createdAt", "updatedAt"] },
    },
  });

  if (users) res.status(200).send(users);
});

router.get("/get/:id", async (req, res) => {
  const loginId = req.params.id;

  const users = await UserProfile.findOne({
    where: {
      loginId: loginId,
    },
    include: {
      model: Login,
      attributes: { exclude: ["password", "createdAt", "updatedAt"] },
    },
  });
  if (!users) return res.status(400).send({ error: "No any user found." });

  res.status(200).send(users);
});

router.post("/sendmail", (req, res) => {
  console.log("request came");
  let user = req.body;
  sendMail(user, "auto-password", (info) => {
    console.log(`The mail has beed send 😃 and the id is ${info.messageId}`);
    res.send(info);
  });
});

async function sendMail(user, userPassword, callback) {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", //host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465, false for 587, false for other ports
    auth: {
      user: "evergreen.group.lanka@gmail.com", //user: "evergreen.group.srilanaka@gmail.com",
      pass: "", //pass: "evergreen@123",
    },
  });
  //"cshop3493@gmail.com","Coffee#123*"
  let mailOptions = {
    from: "evergreen.group.lanka@gmail.com", // sender address
    to: user.email, // list of receivers
    subject: "New Account has been created for your 👻", // Subject line
    html: `<h1>Hi ${user.name}</h1><br>
    <h2>New Account has been created for your 👻<h2>
    <h2>User name will be ${user.email}<h2>
    <h2>Your password: ${userPassword}<h2>
    <h5>Please change your password right after your First login<h5>
    <h4 style="color:Green">Thanks for joining with us</h4>`,
  };

  // send mail with defined transport object
  let info = await transporter.sendMail(mailOptions);

  callback(info);
}

module.exports = router;
