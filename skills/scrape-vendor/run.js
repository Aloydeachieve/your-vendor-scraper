const axios = require("axios");

module.exports = async ({ platform, url }) => {

 const res = await axios.get(
  `https://your-vendor-scraper-production.up.railway.app/api/scrape`,
  { params: { platform, url } }
 );

 return res.data;
};