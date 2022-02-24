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
const POST_STATUS = require("../config/postStatusEnum");

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
  description: Joi.string().required(),
  image: Joi.any(),
  facilities: Joi.string().required(),
});

const getSchema = Joi.object({
  facilities: Joi.any().required(),
  genders: Joi.any().required(),
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

    //Validate Response Body
    const { error, value } = boardingSchema.validate({
      title: req.body.title,
      price: req.body.price,
      location: req.body.location,
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
    if (!user)
      return res
        .status(400)
        .send({ error: "Unautherize user!, you're Not registerd!" });

    //store in Db
    let cData = {
      boarding: {
        title: req.body.title,
        price: req.body.price,
        location: req.body.location,
        category: req.body.category,
        gender: req.body.gender,
        accommodaterId: req.body.accommodaterId,
        description: req.body.description,
        image: req.file.path,
        facilities: req.body.facilities,
      },
    };

    //Begin Transaction
    const t = await db.sequelize.transaction();
    try {
      const ownerUserProf = await UserProfile.findOne({
        where: { loginId: cData.boarding.accommodaterId },
        attributes: ["id"],
      });
      // Reason: accommodaterId = owner's userProfileId
      cData.boarding.accommodaterId = ownerUserProf.id;

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
      console.log(error);
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

//Search Boading by location, facilities
router.post("/:location", validateWith(getSchema), async (req, res) => {
  const loc = req.params.location;
  const facilities = req.body.facilities;
  const genders = req.body.genders;

  let bSearchObj = {};
  if (loc === "all") {
    bSearchObj = {
      gender: {
        [Sequelize.Op.in]: genders,
      },
      status: POST_STATUS.ACTIVE,
    };
  } else {
    bSearchObj = {
      location: loc,
      gender: {
        [Sequelize.Op.in]: genders,
      },
      status: POST_STATUS.ACTIVE,
    };
  }

  let searchObj = {};
  if (facilities.length > 0) {
    searchObj = {
      id: {
        [Sequelize.Op.in]: facilities,
      },
    };
  }

  // To get the data without meta/model information
  const getPlainData = (records) =>
    records != null ? records.map((record) => record.get({ plain: true })) : [];

  const boardings = await Bording.findAll({
    where: bSearchObj,
    order: [["createdAt", "DESC"]],
    include: {
      model: Facility,
      attributes: ["facility"],
      where: searchObj,
      through: { attributes: [] },
    },
    // raw: true, // <---TRUE : Result as a row data array > BUT it returns duplicate data
    // nest: true, //If associations with include
    // *** Do not use raw, nest when fetchin datafrom many to many relation
  }).then(getPlainData);

  if (!boardings)
    return res.status(400).send({ error: "No boardings found so far." });
  let bList = [];

  boardings.map((item) => {
    aBoarding = {
      id: item.id,
      title: item.title,
      price: item.price,
      location: item.location,
      category: item.category,
      gender: item.gender,
      description: item.description,
      image: item.image,
      accommodaterId: item.accommodaterId,
      postedAt: dayjs(item.createdAt).format("YYYY-MM-DD"),
      timeElapsed: dayjs(item.createdAt).from(dayjs(dayjs.utc().format())),
    };
    bList.push(aBoarding);
  });

  res.status(200).send({ data: bList });
  // setTimeout(function () {

  // }, 5000);
});

/**
 * Get a Boading by id & owner id
 * url.../getByid?postId=1&ownerId=1
 */
router.get("/get/", async (req, res) => {
  const boardingId = req.query.boardingId;
  const accommodaterId = req.query.ownerId;
  /**
   To get the data without meta/model information
   const getPlainData = (records) =>   records.map((record) => record.get({ plain: true }));
   */
  const getPlainData = (record) =>
    record != null ? record.get({ plain: true }) : [];

  let result = await UserProfile.findOne({
    attributes: { exclude: ["createdAt", "updatedAt"] },
    include: {
      model: Bording,
      where: { id: boardingId, accommodaterId: accommodaterId },
      attributes: { exclude: ["updatedAt"] },
      include: {
        model: Facility,
        attributes: ["facility"],
        through: { attributes: [] },
      },
    },
    // raw: true, // <---TRUE : Result as a row data array > BUT it returns duplicate data
    // nest: true, // If associations with include
    // *** Do not use raw, nest when fetchin datafrom many to many relation
  }).then(getPlainData);

  if (!result) return res.status(400).send({ error: "Bording Not  found." });

  //console.log(result);
  //console.log(result.bordings[0].facilities);

  if (result.length == 0)
    return res.status(400).send({ error: "Bording Not  found." });

  //Calculae timeElapsed
  timeElapsed = dayjs(result.bordings[0].createdAt).from(
    dayjs(dayjs.utc().format())
  );
  //Format Date
  rowCreatedAt = dayjs(result.bordings[0].createdAt).format("YYYY-MM-DD");

  let listFacilities = [];

  result.bordings[0].facilities.map((item) => {
    listFacilities.push(item.facility);
  });

  let boardingData = {};

  result.bordings.map((item) => {
    boardingData.id = item.id;
    boardingData.title = item.title;
    boardingData.price = item.price;
    boardingData.location = item.location;
    boardingData.category = item.category;
    boardingData.gender = item.gender;
    boardingData.description = item.description;
    boardingData.image = item.image;
  });
  boardingData.postedAt = rowCreatedAt;
  boardingData.timeElapsed = timeElapsed;
  boardingData.facilities = listFacilities;

  ownerData = {
    ownerUserProfileId: result.id,
    fullName: result.fullName,
    address: result.address,
    phone: result.phone,
    occupation: result.occupation,
    gender: result.gender,
  };

  return res.status(200).send({ boarding: boardingData, owner: ownerData });
});

router.get("/getPosts/:ownerId/:postsStatus", async (req, res) => {
  const ownerId = req.params.ownerId;
  const postsStatus = req.params.postsStatus;

  let SearchObj = { accommodaterId: ownerId, status: postsStatus };
  if (ownerId == "0") {
    SearchObj = {
      status: postsStatus,
    };
  }

  /**
   To get the data without meta/model information
   const getPlainData = (records) =>   records.map((record) => record.get({ plain: true }));
   */
  const getPlainData = (record) =>
    record != null ? record.get({ plain: true }) : [];

  let result = await UserProfile.findOne({
    attributes: { exclude: ["createdAt", "updatedAt"] },
    include: {
      model: Bording,
      where: SearchObj,
      attributes: { exclude: ["updatedAt"] },
      include: {
        model: Facility,
        attributes: ["facility"],
        through: { attributes: [] },
      },
    },
  }).then(getPlainData);

  if (!result) return res.status(400).send({ error: "Bordings Not  found." });

  return res.status(200).send(result);
});

router.patch("/setPostStatus/:postId/:status", async (req, res) => {
  const status = req.params.status;
  const postId = req.params.postId;

  let postStatus = "";
  switch (status) {
    case POST_STATUS.ACTIVE:
      postStatus = POST_STATUS.ACTIVE;
      break;
    case POST_STATUS.PENDING:
      postStatus = POST_STATUS.PENDING;
      break;
    case POST_STATUS.DENIED:
      postStatus = POST_STATUS.DENIED;
      break;
    case POST_STATUS.EXPIRED:
      postStatus = POST_STATUS.EXPIRED;
      break;
    default:
      return res.status(400).send({ error: "Error! Invalid post status type" });
  }

  const post = await Bording.findByPk(postId);
  if (!post)
    return res.status(400).send({ error: "Error! Couldn't find post" });

  post.set({
    status: postStatus,
    createdAt: dayjs(),
  });

  const savePost = await post.save();
  if (!savePost)
    return res
      .status(400)
      .send({ error: "Error! Couldn't set status, try again" });

  return res.status(200).send({ data: `Status updated to ${postStatus}` });
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
