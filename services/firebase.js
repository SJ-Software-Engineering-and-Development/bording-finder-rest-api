let admin = require("firebase-admin");
let serviceAccount = require("../config/firebase-key.json");

const db = require("../models");
const Login = db.login;
const UserProfile = db.userProfile;
const ROLE = require("../config/roleEnum");

const Joi = require("joi");

const deleteSchema = Joi.object({
  fileName: Joi.string().required(),
});

const userSchema = Joi.object({
  fullName: Joi.string().required(),
  address: Joi.string().required(),
  phone: Joi.string().required(),
  occupation: Joi.string().required(),
  gender: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(4),
  avatar: Joi.any(), //can submit null
});

const boardingSchema = Joi.object({
  title: Joi.string().required(),
  price: Joi.string().required(),
  location: Joi.string().required(),
  longitude: Joi.string(), //Optional
  latitude: Joi.string(), //Optional
  category: Joi.string().required(),
  gender: Joi.string().required(),
  accommodaterId: Joi.string().required(),
  description: Joi.string().required(),
  image: Joi.any(),
  facilities: Joi.string().required(),
});

const BUCKET = "covid-19-self-care-app.appspot.com";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: BUCKET,
});

const bucket = admin.storage().bucket();
const storage = admin.storage();

/** R E Q U I R E D
 * 1. goto project settings
 * 2. goto serive accounts tab
 * 3. select Node js
 * 4. genarate new private key - then a file will download
 * 5. create firebase-key.json file under config folder
 * 6. copy content of above downloaded file into firebase-key.json
 * Change Rules : storage -> rules
  https://console.firebase.google.com/u/1/project/gfod-app/storage/gfod-app.appspot.com/rules

  allow read, write: if true;

  https://www.youtube.com/watch?v=uR3Pb8XD5lE
*/

const deleteAvatar = async (req, res, next) => {
  const dir = "avatars";

  //Avoid deleting default image on bucket
  if (req.body.fileName == "default-avatar.png") return next();

  //Data Validation
  const { error, value } = deleteSchema.validate({
    fileName: req.body.fileName,
  });
  if (error) return res.status(400).send({ error: error.details[0].message });

  const filePath = `${dir}/${req.body.fileName}`;
  const file = bucket.file(filePath);

  file
    .delete()
    .then(() => {
      console.log(`Successfully deleted photo:`);
    })
    .catch((err) => {
      console.log(`Failed to remove photo, error: ${err}`);
    });

  next();
};

const deleteAllAvatar = async (req, res, next) => {
  const folderName = "avatars";

  await bucket.delete({
    prefix: `${folderName}`,
  });

  next();
};

const uploadAvatar = async (req, res, next) => {
  if (!req.file) return next();

  //Data Validations
  switch (req.params.role) {
    case ROLE.Client:
      break;
    case ROLE.Accommodater:
      break;
    case ROLE.Admin:
      break;
    case ROLE.Moderator:
      break;
    default:
      return res.status(400).send({ error: "Error! Invalid user type" });
  }

  const { error, value } = userSchema.validate({
    fullName: req.body.fullName,
    address: req.body.address,
    phone: req.body.phone,
    occupation: req.body.occupation,
    gender: req.body.gender,
    email: req.body.email,
    password: req.body.password,
  });
  if (error) return res.status(400).send({ error: error.details[0].message });

  //Check this user acc already exits
  const oldUser = await Login.findOne({
    where: { email: req.body.email },
  });
  if (oldUser) {
    return res
      .status(400)
      .send({ error: "A user with the given email already exists." });
  }

  // if (!req.file) return res.status(400).send({ error: "File not provided" });
  const image = req.file;
  const dir = "avatars";

  const fileName = Date.now() + "." + image.originalname.split(".").pop();

  const file = bucket.file(`${dir}/${fileName}`);

  const stream = file.createWriteStream({
    metadata: {
      contentType: "image/jpg", // image.mimetype
    },
  });

  stream.on("error", (e) => {
    console.error(e);
    return res.status(400).send({ error: "couldn't save file in bucket" });
  });

  stream.on("finish", async () => {
    try {
      // await file.makePublic();
      //Make all objects in a bucket publicly readable
      await storage.bucket(BUCKET).makePublic();

      req.file.firebaseUrl = `http://storage.googleapis.com/${BUCKET}/${dir}/${fileName}`;
      req.file.fileName = fileName;
      next();
    } catch (error) {
      console.error(error);
    }
  });

  stream.end(image.buffer);
};

const uploadPostImage = async (req, res, next) => {
  if (!req.file) return next();

  //Data Validations
  const { error, value } = boardingSchema.validate({
    title: req.body.title,
    price: req.body.price,
    location: req.body.location,
    longitude: req.body.longitude,
    latitude: req.body.latitude,
    category: req.body.category,
    gender: req.body.gender,
    accommodaterId: req.body.accommodaterId,
    description: req.body.description,
    image: req.file.path,
    facilities: req.body.facilities,
  });
  if (error) return res.status(400).send({ error: error.details[0].message });

  //Check owner whether registerd
  const user = await Login.findByPk(req.body.accommodaterId);
  if (!user) return res.status(400).send({ error: "Unautherize user!" });

  // if (!req.file) return res.status(400).send({ error: "File not provided" });
  const image = req.file;
  const dir = "post_images";

  const fileName = Date.now() + "." + image.originalname.split(".").pop();

  const file = bucket.file(`${dir}/${fileName}`);

  const stream = file.createWriteStream({
    metadata: {
      contentType: "image/jpg", // image.mimetype
    },
  });

  stream.on("error", (e) => {
    console.error(e);
    return res.status(400).send({ error: "couldn't save file in bucket" });
  });

  stream.on("finish", async () => {
    try {
      // await file.makePublic();
      //Make all objects in a bucket publicly readable
      await storage.bucket(BUCKET).makePublic();

      req.file.firebaseUrl = `http://storage.googleapis.com/${BUCKET}/${dir}/${fileName}`;
      req.file.fileName = fileName;
      next();
    } catch (error) {
      console.error(error);
    }
  });

  stream.end(image.buffer);
};

module.exports = {
  uploadAvatar,
  deleteAvatar,
  deleteAllAvatar,
  uploadPostImage,
};
