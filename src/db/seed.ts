import { seedDemoData } from "./seed-data";

seedDemoData()
  .then((msg) => {
    console.log(msg);
    console.log("Run `npm run dev` and open http://localhost:3000");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
