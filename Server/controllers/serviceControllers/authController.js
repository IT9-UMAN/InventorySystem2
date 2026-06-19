const Admin = require("../../models/serviceInventoryModels/adminSchema");
const ServicePerson = require("../../models/serviceInventoryModels/servicePersonSchema");
const WarehousePerson = require("../../models/serviceInventoryModels/warehousePersonSchema");
const SurveyPerson = require("../../models/serviceInventoryModels/surveyPersonSchema");
const Warehouse = require("../../models/serviceInventoryModels/warehouseSchema");
const Item = require("../../models/serviceInventoryModels/itemSchema");
const {
  createSecretToken,
  createRefreshToken,
} = require("../../util/secretToken");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { refreshToken } = require("../../middlewares/authMiddlewares");
const AppVersion = require("../../models/commonModels/appVersionSchema");

module.exports.adminSignup = async (req, res) => {
  const { email, password, createdAt, role } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  if (!password) {
    return res.status(400).json({
      success: false,
      message: "Password is required",
    });
  }

  try {
    const existingEmployee = await Promise.all([
      Admin.findOne({ email: email }),
      WarehousePerson.findOne({ email: email }),
      ServicePerson.findOne({ email: email }),
      SurveyPerson.findOne({ email: email }),
    ]);

    // If any user exists in any collection, return an error
    if (existingEmployee.some((emp) => emp)) {
      return res.status(400).json({
        success: false,
        message: "Employee Already Exists In Database",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new Admin({
      email: normalizedEmail,
      password: hashedPassword,
      createdAt,
      role,
    });
    await newUser.save();
    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      data: newUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports.warehousePersonSignup = async (req, res) => {
  const { name, email, warehouse, contact, password, role, createdAt } =
    req.body;
  if (!name || !email || !warehouse || !contact || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    const existingEmployee = await Promise.all([
      Admin.findOne({ $or: [{ email }, { contact }] }),
      WarehousePerson.findOne({ $or: [{ email }, { contact }] }),
      ServicePerson.findOne({ $or: [{ email }, { contact }] }),
      SurveyPerson.findOne({ $or: [{ email }, { contact }] }),
    ]);

    // If any user exists in any collection, return an error
    if (existingEmployee.some((emp) => emp)) {
      return res.status(400).json({
        success: false,
        message: "Employee Already Exists In Database",
      });
    }

    const existingWarehouse = await Warehouse.findOne({
      warehouseName: warehouse,
    });
    if (!existingWarehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse Not Found",
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const hashedPassword = await bcrypt.hash(password, 10);
    const newWarehousePerson = new WarehousePerson({
      name,
      email: normalizedEmail,
      warehouse: existingWarehouse._id,
      contact,
      password: hashedPassword,
      role,
      createdAt,
      refreshToken: null,
    });

    await newWarehousePerson.save();
    res.status(200).json({
      success: true,
      message: "Warehouse Person registered successfully",
      data: {
        name: newWarehousePerson.name,
        email: newWarehousePerson.email,
        warehouse: newWarehousePerson.warehouse,
        contact: newWarehousePerson.contact,
        //password: newWarehousePerson.password,
        createdAt: newWarehousePerson.createdAt,
        role: newWarehousePerson.role,
        //refreshToken,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports.servicePersonSignup = async (req, res) => {
  const {
    name,
    email,
    contact,
    password,
    createdAt,
    role,
    longitude,
    latitude,
    state,
    district,
    block,
    createdBy
  } = req.body;
  if (!name || !email || !contact || !password || !createdBy) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    const existingEmployee = await Promise.all([
      Admin.findOne({ $or: [{ email }, { contact }] }),
      WarehousePerson.findOne({ $or: [{ email }, { contact }] }),
      ServicePerson.findOne({ $or: [{ email }, { contact }] }),
      SurveyPerson.findOne({ $or: [{ email }, { contact }] }),
    ]);

    // If any user exists in any collection, return an error
    if (existingEmployee.some((emp) => emp)) {
      return res.status(400).json({
        success: false,
        message: "Employee Already Exists In Database",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let blockArray;
    if (block) {
      blockArray = block.split(",").map((b) => b.trim());
    }
    const normalizedEmail = email.toLowerCase().trim();
    const newServicePerson = new ServicePerson({
      name,
      email: normalizedEmail,
      contact,
      password: hashedPassword,
      longitude: longitude || null,
      latitude: latitude || null,
      state: state || "",
      district: district || "",
      block: blockArray || [],
      createdAt,
      createdBy: createdBy,
      role,
      refreshToken: null,
    });
    await newServicePerson.save();
    res.status(200).json({
      success: true,
      message: "Service Person registered successfully",
      data: {
        name: newServicePerson.name,
        email: newServicePerson.email,
        contact: newServicePerson.contact,
        password: newServicePerson.password,
        longitude: newServicePerson.longitude,
        latitude: newServicePerson.latitude,
        createdAt: newServicePerson.createdAt,
        createdBy: newServicePerson.createdBy,
        role: newServicePerson.role,
        state: newServicePerson.state,
        district: newServicePerson.district,
        block: newServicePerson.block,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports.surveyPersonSignup = async (req, res) => {
  const {
    name,
    email,
    contact,
    password,
    role,
    longitude,
    latitude,
    state,
    district,
    block,
    createdAt,
  } = req.body;
  if (!name || !email || !contact || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }
  try {
    const existingEmployee = await Promise.all([
      Admin.findOne({ $or: [{ email }, { contact }] }),
      WarehousePerson.findOne({ $or: [{ email }, { contact }] }),
      ServicePerson.findOne({ $or: [{ email }, { contact }] }),
      SurveyPerson.findOne({ $or: [{ email }, { contact }] }),
    ]);

    // If any user exists in any collection, return an error
    if (existingEmployee.some((emp) => emp)) {
      return res.status(400).json({
        success: false,
        message: "Employee Already Exists In Database",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let blockArray;
    if (block) {
      blockArray = block.split(",").map((b) => b.trim());
    }
    const normalizedEmail = email.toLowerCase().trim();
    const newSurveyPerson = new SurveyPerson({
      name,
      email: normalizedEmail,
      contact,
      password: hashedPassword,
      longitude: longitude || null,
      latitude: latitude || null,
      state: state || "",
      district: district || "",
      block: blockArray || [],
      createdAt,
      createdBy: req.user._id,
      role,
      refreshToken: null,
    });
    await newSurveyPerson.save();
    res.status(200).json({
      success: true,
      message: "Survey Person registered successfully",
      data: {
        name: newSurveyPerson.name,
        email: newSurveyPerson.email,
        contact: newSurveyPerson.contact,
        password: newSurveyPerson.password,
        longitude: newSurveyPerson.longitude,
        latitude: newSurveyPerson.latitude,
        createdAt: newSurveyPerson.createdAt,
        createdBy: newSurveyPerson.createdBy,
        role: newSurveyPerson.role,
        state: newSurveyPerson.state,
        district: newSurveyPerson.district,
        block: newSurveyPerson.block,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports.updateServicePerson = async (req, res) => {
  try {
    const {
      servicePersonId,
      name,
      email,
      contact,
      state,
      district,
      block,
      longitude,
      latitude,
      updatedAt,
      updatedBy
    } = req.body;

    if (!servicePersonId) {
      return res.status(400).json({
        success: false,
        message: "Service Person ID is required",
      });
    }

    // Find the service person by ID
    const servicePersonData = await ServicePerson.findOne({
      _id: servicePersonId,
    });
    if (!servicePersonData) {
      return res.status(404).json({
        success: false,
        message: "Service Person not found",
      });
    }

    if (name) servicePersonData.name = name;
    if (email) servicePersonData.email = email;
    if (contact) {
      servicePersonData.contact = contact;
    }
    if (state) servicePersonData.state = state;
    if (district) servicePersonData.district = district;
    let blockArray;
    if (block) {
      blockArray = block.split(",").map((b) => b.trim());
      servicePersonData.block = blockArray;
    }
    if (longitude) servicePersonData.longitude = longitude;
    if (latitude) servicePersonData.latitude = latitude;

    servicePersonData.updatedAt = updatedAt;
    servicePersonData.updatedBy = updatedBy || null;

    const updatedData = await servicePersonData.save();

    return res.status(200).json({
      success: true,
      message: "Service Person updated successfully",
      data: updatedData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports.Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // const { email, password, role } = req.body;

    const options = {
      withCredentials: true,
      httpOnly: true,
      secure: false,
    };

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    // let user = await Admin.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i'), role })||
    //   await WarehousePerson.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i'), role }).populate('warehouse') ||
    //   await ServicePerson.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i'), role }) ||
    //   await SurveyPerson.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i'), role });

    let user =
      (await Admin.findOne({
        email: new RegExp(`^${normalizedEmail}$`, "i"),
      })) ||
      (await WarehousePerson.findOne({
        email: new RegExp(`^${normalizedEmail}$`, "i"),
      }).populate("warehouse")) ||
      (await ServicePerson.findOne({
        email: new RegExp(`^${normalizedEmail}$`, "i"),
      })) ||
      (await SurveyPerson.findOne({
        email: new RegExp(`^${normalizedEmail}$`, "i"),
      }));

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password",
      });
    }
    // Check if the account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Compare password
    const auth = await bcrypt.compare(password, user.password);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password",
      });
    }
    //const role = roles[email] || 'serviceperson';
    //const role = user.role;
    const accessToken = createSecretToken(user._id, user?.role);
    const refreshToken = createRefreshToken(user._id);

    // Update the refreshToken in the database
    if (user.constructor.modelName === "Admin") {
      await Admin.findByIdAndUpdate(user._id, {
        refreshToken: refreshToken,
      });
    } else if (user.constructor.modelName === "WarehousePerson") {
      await WarehousePerson.findByIdAndUpdate(user._id, {
        refreshToken: refreshToken,
      });
    } else if (user.constructor.modelName === "ServicePerson") {
      await ServicePerson.findByIdAndUpdate(user._id, {
        refreshToken: refreshToken,
      });
    } else {
      await SurveyPerson.findByIdAndUpdate(user._id, {
        refreshToken: refreshToken,
      });
    }

    const appVersionData = await AppVersion.find({});
    console.log(appVersionData)
    console.log(appVersionData[0].appVersion)
    // Set cookies for tokens
    // console.log(user.block);
    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        success: true,
        message: `Logged in successfully`,
        id: user._id,
        email: user.email,
        warehouse: user.warehouse ? user.warehouse.warehouseName : null,
        contact: user.contact,
        block: user.block || [],
        state: user.state || null,
        latitude: user.latitude || null,
        longitude: user.longitude || null,
        // accessToken,
        // refreshToken,
        role: user.role || null,
        appVersion: appVersionData[0]?.appVersion,
        appLink: appVersionData[0]?.link
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports.Logout = async (req, res) => {
  try {
    const userID = req.user._id; // req.user will contain either User or ServicePerson based on the role
    const role = req.user.role; // Assuming role is set in the token

    if (role === "serviceperson") {
      await ServicePerson.findByIdAndUpdate(userID, {
        $set: { refreshToken: null },
      });
    } else if (role === "warehouseAdmin") {
      await WarehousePerson.findByIdAndUpdate(userID, {
        $set: { refreshToken: null },
      });
    } else {
      await Admin.findByIdAndUpdate(userID, {
        $set: { refreshToken: null },
      });
    }

    return res
      .status(200)
      .clearCookie("accessToken", { httpOnly: true, secure: false })
      .clearCookie("refreshToken", { httpOnly: true, secure: false })
      .json({
        success: true,
        message: "Logged Out Successfully",
      });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const servicePerson = await ServicePerson.findById(req.user._id);

    if (!servicePerson) {
      return res
        .status(404)
        .json({ success: false, message: "Service person not found" });
    }

    // Check if the current password is correct
    const isMatch = await bcrypt.compare(
      currentPassword,
      servicePerson.password
    );
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    servicePerson.password = hashedPassword;
    await servicePerson.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports.addIsActiveField = async (req, res) => {
  try {
    const allWarehousePersons = await WarehousePerson.find();
    const allServicePersons = await ServicePerson.find();

    for (let emp of allServicePersons) {
      emp.isActive = true;
      emp.updatedBy = "67446a4296f7ef394e784136";
      await emp.save();
    }

    for (let emp of allWarehousePersons) {
      emp.isActive = true;
      emp.updatedBy = "67446a4296f7ef394e784136";
      await emp.save();
    }
    return res.status(200).json({
      success: true,
      message: "isActive Added successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports.validateRefreshToken = async (req, res) => {
  const refreshToken = req.body.refreshToken;
  const options = {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
  };

  if (!refreshToken) {
    return res
      .status(401)
      .json({ success: false, message: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_KEY);

    let user = null;
    let role = null;

    // Try to find user in Admin
    user = await Admin.findById(decoded.id);
    if (user && user.refreshToken === refreshToken) role = "admin";

    // If not Admin, check ServicePerson
    if (!user || user.refreshToken !== refreshToken) {
      user = await ServicePerson.findById(decoded.id);
      if (user && user.refreshToken === refreshToken) role = user.role;
    }

    // If still not found, check SurveyPerson
    if (!user || user.refreshToken !== refreshToken) {
      user = await SurveyPerson.findById(decoded.id);
      if (user && user.refreshToken === refreshToken) role = "surveyperson";
    }

    if (!user || user.refreshToken !== refreshToken) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid refresh token" });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "User is blocked."
      });
    }

    // Generate new tokens
    const newAccessToken = createSecretToken(user._id, role);
    const newRefreshToken = createRefreshToken(user._id);

    // Update user's refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set cookies
    return res
      .status(201)
      .cookie("accessToken", newAccessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json({
        success: true,
        message: `Welcome back ${user.name}!`,
        role,
        refreshToken: newRefreshToken,
      });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
