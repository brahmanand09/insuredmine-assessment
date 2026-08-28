const importService = require('../services/importService');

exports.importData = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a valid XLSX or CSV file.'
      });
    }

    const result = await importService.importFileData(req.file.path);

    return res.status(200).json({
      success: true,
      message: 'File data successfully imported into MongoDB collections via Worker Thread!',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
