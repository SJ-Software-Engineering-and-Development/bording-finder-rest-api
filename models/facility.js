module.exports = (Sequelize, DataTypes) => {
  const Facility = Sequelize.define("facility", {
    facility: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  return Facility;
};
