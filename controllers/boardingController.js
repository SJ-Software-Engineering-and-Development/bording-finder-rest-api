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
      accommodaterId: req.body.accommodaterId,
      image: req.file.path,
    });
    if (error) return res.status(400).send({ error: error.details[0].message });

    const title = req.body.title;
    const price = req.body.price;
    const location = req.body.location;
    const ownerName = req.body.ownerName;
    const facilities = req.body.facilities;
    const accommodaterId = req.body.accommodaterId;
    const image = req.file.path;

    // const oldCategory = await Category.findOne({
    //   where: { name: name },
    // });
    // if (oldCategory) {
    //   //Remove uploaded file from ./uploads folder
    //   fs.unlink(req.file.path, (err) => {
    //     if (err) {
    //       console.error(err);
    //     }
    //     //(->)file removed success
    //   });
    //   return res
    //     .status(400)
    //     .send({ error: "A catagory with the given name already exists." });
    // }

    //store in Db
    let cData = {
      boarding: {
        title: title,
        price: price,
        location: location,
        ownerName: ownerName,
        facilities: facilities,
        accommodaterId: accommodaterId,
        image: image,
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
  const loc = req.params.location; //all | active | deactive

  const boardings = await Bording.findAll({
    where: { location: loc },
  });

  if (!boardings)
    return res.status(400).send({ error: "No categories found." });
  res.status(200).send(boardings);
});

module.exports = router;
