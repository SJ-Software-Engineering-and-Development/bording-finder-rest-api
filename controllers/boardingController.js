const Joi = require("joi");
const validateWith = require("../middleware/validation");
const router = require("express").Router();
const verifyToken = require("../middleware/verifyToken");
const multer = require("multer");
const fs = require("fs");

const imgHelper = require("../helpers/imageFilter");
const imgStorage = require("../storageConfig");

const db = require("../models");
const Login = db.login;
const UserProfile = db.userProfile;
const Bording = db.bording;

const boardingSchema = Joi.object({
  title: Joi.string().required(),
  price: Joi.string().required(),
  location: Joi.string().required(),
  ownerName: Joi.string().required(),
  facilities: Joi.string().required(),
  gender: Joi.string().required(),
  accommodaterId: Joi.string().required(),
  image: Joi.any(),
});

router.post("/", async (req, res) => {
  const upload = multer({
    storage: imgStorage.storage,
    limits: { fileSize: 1024 * 1024 * 5 },
    fileFilter: imgHelper.imageFilter,
  }).single("image");

  upload(req, res, async function (err) {
    // req.file contains information of uploaded file
    // req.body contains information of text fields, if there were any

    if (req.fileValidationError) {
      return res.status(400).send({ error: req.fileValidationError });
    } else if (!req.file) {
      return res
        .status(400)
        .send({ error: "Please select an image to upload" });
    } else if (err instanceof multer.MulterError) {
      return res.status(400).send({ error: err });
    } else if (err) {
      return res.status(400).send({ error: err });
    }

    const { error, value } = boardingSchema.validate({
      title: req.body.title,
      price: req.body.price,
      location: req.body.location,
      ownerName: req.body.ownerName,
      facilities: req.body.facilities,
      gender: req.body.gender,
      accommodaterId: req.body.accommodaterId,
      image: req.file.path,
    });
    if (error) return res.status(400).send({ error: error.details[0].message });

    //store in Db
    let cData = {
      boarding: {
        title: req.body.title,
        price: req.body.price,
        location: req.body.location,
        ownerName: req.body.ownerName,
        facilities: req.body.facilities,
        gender: req.body.gender,
        accommodaterId: req.body.accommodaterId,
        image: req.file.path,
      },
    };

    const newBoarding = await Bording.create(cData.boarding);
    //status has default values no need to set here
    if (!newBoarding)
      return res
        .status(400)
        .send({ error: "Error! Server having some trubles" });

    return res.status(200).send({
      data: `New boarding has been added!`,
    });
  });
});

router.get("/:location", async (req, res) => {
  const loc = req.params.location;
  //many to many (UserProfile has many boardings)
  const boardings = await UserProfile.findAll({
    include: {
      model: Bording,
      where: { location: loc }, //Where clause for inner model
    },
  });

  if (!boardings)
    return res.status(400).send({ error: "No categories found." });
  res.status(200).send(boardings);
});

module.exports = router;
