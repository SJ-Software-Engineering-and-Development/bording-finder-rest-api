const Joi = require("joi");
const router = require("express").Router();

const validateWith = require("../middleware/validation");
const db = require("../models");
const Facility = db.facility;

const schema = Joi.object({
  facility: Joi.string().required(),
});

router.post("/", validateWith(schema), async (req, res) => {
  const data = req.body;

  const result = await Facility.create(data);
  if (!result)
    return res.status(400).send({ error: "Error! Server having some trubles" });

  return res.status(200).send({
    data: `New facility has been added!`,
  });
});

router.get("/", async (req, res) => {
  const result = await Facility.findAll();
  if (!result)
    return res.status(400).send({ error: "Error! Server having some trubles" });

  return res.status(200).send({
    data: result,
  });
});

module.exports = router;
