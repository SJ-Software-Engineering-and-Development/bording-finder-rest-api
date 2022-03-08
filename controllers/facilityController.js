const Joi = require("joi");
const router = require("express").Router();

const validateWith = require("../middleware/validation");
const db = require("../models");
const Facility = db.facility;
const BoardingFacility = db.boardingFacility;

const schema = Joi.object({
  facility: Joi.string().required(),
});

const updateSchema = Joi.object({
  id: Joi.number().required(),
  facility: Joi.string().required().min(2),
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
  const result = await Facility.findAll({
    attributes: { exclude: ["createdAt", "updatedAt"] },
  });
  if (!result)
    return res.status(400).send({ error: "Error! Server having some trubles" });

  return res.status(200).send({
    data: result,
  });
});

router.patch("/", validateWith(updateSchema), async (req, res) => {
  const facData = req.body;

  const aFacility = await Facility.findByPk(facData.id);
  if (!aFacility)
    return res.status(400).send({ error: "Vaccine not found for given ID" });

  aFacility.set({
    facility: facData.facility,
  });
  updateC = await aFacility.save();

  if (!updateC)
    return res.status(400).send({ error: "Error! Server having some trubles" });

  return res.status(200).send({
    data: `The facility has been updated successfuly`,
  });
});

router.delete("/:id", async (req, res) => {
  const facId = req.params.id;

  const result = await Facility.findByPk(facId);
  if (!result)
    return res.status(400).send({ error: "Vaccine not found for given ID" });

  let usingRows = 0;
  await BoardingFacility.count({ where: { facilityId: facId } }).then((c) => {
    usingRows = c;
  });

  if (usingRows > 0)
    return res.status(400).send({
      error: `This Facility has been already using in ${usingRows} boarding post(s)`,
    });

  const del = await result.destroy();
  if (!del)
    return res
      .status(400)
      .send({ error: "Cannot Delete facility, Try again!" });

  return res.status(200).send({
    data: "The Facility deleted successfuly",
  });
});

module.exports = router;
