/** @type {import("tailwindcss").Config} */
export default {
  content: ["./src/**/*.{astro,html,js,ts,md}"],
  theme: { extend: { colors: { brand: { 50:"#eef4ff",100:"#d9e6ff",500:"#3b6ef6",600:"#2f5ad6",700:"#264bb0",900:"#0b1b3a" } } } },
  plugins: [],
};
