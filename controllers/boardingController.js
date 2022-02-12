const Joi = require("joi");
const validateWith = require("../middleware/validation");
const router = require("express").Router();
const verifyToken = require("../middleware/verifyToken");
const multer = require("multer");
const fs = require("fs");
const { Sequelize } = require("sequelize");
const querystring = require("querystring");

const dayjs = require("dayjs");
var relativeTime = require("dayjs/plugin/relativeTime");
dayjs.extend(relativeTime);
var utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

const imgHelper = require("../helpers/imageFilter");
const imgStorage = require("../storageConfig");

const db = require("../models");
const Login = db.login;
const UserProfile = db.userProfile;
const Bording = db.bording;
const Facility = db.facility;
const BoardingFacility = db.boardingFacility;

const boardingSchema = Joi.object({
  title: Joi.string().required(),
  price: Joi.string().required(),
  location: Joi.string().required(),
  category: Joi.string().required(),
  gender: Joi.string().required(),
  accommodaterId: Joi.string().required(),
  image: Joi.any(),
  facilities: Joi.string().required(),
});

const getSchema = Joi.object({
  facilities: Joi.any().required(),
});

//Create New Boarding
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
      category: req.body.category,
      gender: req.body.gender,
      accommodaterId: req.body.accommodaterId,
      image: req.file.path,
      facilities: req.body.facilities,
    });
    if (error) return res.status(400).send({ error: error.details[0].message });

    //store in Db
    let cData = {
      boarding: {
        title: req.body.title,
        price: req.body.price,
        location: req.body.location,
        category: req.body.category,
        gender: req.body.gender,
        accommodaterId: req.body.accommodaterId,
        image: req.file.path,
        facilities: req.body.facilities,
      },
    };

    //Begin Transaction
    const t = await db.sequelize.transaction();
    try {
      const newBoarding = await Bording.create(cData.boarding);
      //status has default values no need to set here
      if (!newBoarding)
        return res
          .status(400)
          .send({ error: "Error! Server having some trubles" });

      //Facility ids should be send in the form of comma separated
      const facilities = cData.boarding.facilities.split(",");

      const fData = [];
      facilities.forEach((item, index) => {
        fData.push({ facilityId: item, bordingId: newBoarding.id });
      });

      await BoardingFacility.bulkCreate(fData);

      await t.commit(); // End & commit the transaction.
    } catch (error) {
      await t.rollback(); //End & rollback the transaction.

      //Remove uploaded file from ./uploads folder
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error(err);
        }
        //file removed success
      });

      return res
        .status(400)
        .send({ error: "Error! Data didn`t saved, Try again" });
    }

    return res.status(200).send({
      data: `New boarding has been added!`,
    });
  });
});

//Search Boading
router.post("/:location", validateWith(getSchema), async (req, res) => {
  const loc = req.params.location;

  const facilities = req.body.facilities;

  let searchObj = {};
  if (facilities.length > 0) {
    searchObj = {
      id: {
        [Sequelize.Op.in]: facilities,
      },
    };
  }

  const boardings = await Bording.findAll({
    where: { location: loc },
    order: [["createdAt", "DESC"]],
    include: {
      model: Facility,
      attributes: ["facility"],
      where: searchObj,
    },
    raw: true, // <---TRUE : Result as a row data array
    nest: true, //If associations with include
  });

  if (!boardings)
    return res.status(400).send({ error: "No categories found." });
  let bList = [];
  boardings.map((item) => {
    aBoarding = {
      id: item.id,
      title: item.title,
      price: item.price,
      location: item.location,
      category: item.category,
      gender: item.gender,
      image: item.image,
      accommodaterId: item.accommodaterId,
      postedAt: dayjs(item.createdAt).format("YYYY-MM-DD"),
      timeElapsed: dayjs(item.createdAt).from(dayjs(dayjs.utc().format())),
    };
    bList.push(aBoarding);
  });

  res.status(200).send({ data: bList });
});

/**
 * Get a Boading by id & owner id
 * url.../getByid?postId=1&ownerId=1
 */
router.get("/get/", async (req, res) => {
  const postId = req.query.postId;
  const accommodaterId = req.query.ownerId;

  let result = await UserProfile.findOne({
    attributes: { exclude: ["createdAt", "updatedAt"] },
    include: {
      model: Bording,
      where: { id: postId, accommodaterId: accommodaterId },
      attributes: { exclude: ["updatedAt"] },
    },
    raw: true, // <---TRUE : Result as a row data array
    nest: true, //If associations with include
  });

  if (!result) return res.status(400).send({ error: "Bording Not  found." });

  result.bordings.createdAt = dayjs(result.bordings.createdAt).format(
    "YYYY-MM-DD"
  );

  return res.status(200).send({ data: result });
});

/*
  ####### Referring to other columns  #######  --> https://sequelize.org/master/manual/eager-loading.html

  If you want to apply a WHERE clause in an included model referring to a value from an associated model, you can simply use the Sequelize.col function, as show in the example below:

  // Find all projects with a least one task where task.state === project.state
  Project.findAll({
    include: {
      model: Task,
      where: {
        state: Sequelize.col('project.state')
      }
    }
  })
*/

module.exports = router;
