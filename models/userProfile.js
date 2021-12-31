module.exports = (Sequelize, DataTypes) => {
  const UserProfile = Sequelize.define("userProfile", {
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    occupation: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  return UserProfile;
};
