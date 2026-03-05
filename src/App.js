import React, { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import NavBar from "./components/NavBar";
import InventoryPage from "./components/InventoryPage";
import JobLogPage from "./components/JobLogPage";
import ProjectSetupPage from "./components/ProjectSetupPage";
import DamageDashboard from "./components/DamageDashboard";

const INITIAL_ITEMS = [

  // ─── ABRASIVES ───────────────────────────────────────────────
  { id: 1,  name: "Sandpaper ø150 K40 (Klingspor WP733)", quantity: 0, unit: "box", category: "Abrasive", notes: "P40 grit, 150mm / 50pcs per box" },
  { id: 2,  name: "Sandpaper ø150 K60 (Klingspor WP733)", quantity: 0, unit: "box", category: "Abrasive", notes: "P60 grit, 150mm / 50pcs per box" },
  { id: 3,  name: "Sandpaper ø150 K80 (Klingspor WP733)", quantity: 0, unit: "box", category: "Abrasive", notes: "P80 grit, 150mm / 100pcs per box" },
  { id: 4,  name: "Sandpaper ø150 K120 (Klingspor WP733)", quantity: 0, unit: "box", category: "Abrasive", notes: "P120 grit, 150mm / 100pcs per box" },
  { id: 5,  name: "Sandpaper ø150 K180 (Klingspor WP733)", quantity: 0, unit: "box", category: "Abrasive", notes: "P180 grit, 150mm / 100pcs per box" },
  { id: 6,  name: "Sandpaper ø150 K220 (Klingspor WP733)", quantity: 0, unit: "box", category: "Abrasive", notes: "P220 grit, 150mm / 100pcs per box" },
  { id: 7,  name: "Sandpaper ø150 K240 (Klingspor WP733)", quantity: 0, unit: "box", category: "Abrasive", notes: "P240 grit, 150mm / 100pcs per box" },
  { id: 8,  name: "Flap Disc K40 ø125 (Klingspor SMT342)", quantity: 0, unit: "pcs", category: "Abrasive", notes: "P40, 125mm × 22.23mm" },
  { id: 9,  name: "Flap Disc K60 ø125 (Klingspor SMT342)", quantity: 0, unit: "pcs", category: "Abrasive", notes: "P60, 125mm × 22.23mm" },
  { id: 10, name: "Cutting Disk 125 INOX", quantity: 0, unit: "box", category: "Abrasive", notes: "125mm × 1.0 × 22.23mm" },
  { id: 11, name: "Grinding Disc K36 ø125 (Klingspor CS561)", quantity: 0, unit: "box", category: "Abrasive", notes: "P36, 125mm / 25pcs per box" },
  { id: 12, name: "Grinding Disc K60 ø125 (Klingspor CS561)", quantity: 0, unit: "box", category: "Abrasive", notes: "P60, 125mm / 25pcs per box" },
  { id: 13, name: "Sanding Paper 110V #40", quantity: 0, unit: "box", category: "Abrasive", notes: "For 110V sander" },
  { id: 14, name: "Sanding Paper 110V #80", quantity: 0, unit: "box", category: "Abrasive", notes: "For 110V sander" },
  { id: 15, name: "Sanding Paper 110V #100", quantity: 0, unit: "box", category: "Abrasive", notes: "For 110V sander" },
  { id: 16, name: "Sanding Paper 110V #120", quantity: 0, unit: "box", category: "Abrasive", notes: "For 110V sander" },
  { id: 17, name: "Sanding Paper 110V #150", quantity: 0, unit: "box", category: "Abrasive", notes: "For 110V sander" },
  { id: 18, name: "Sanding Paper 110V #180", quantity: 0, unit: "box", category: "Abrasive", notes: "For 110V sander" },
  { id: 19, name: "Sanding Paper 110V #240", quantity: 0, unit: "box", category: "Abrasive", notes: "For 110V sander" },
  { id: 20, name: "Sanding Paper 110V #320", quantity: 0, unit: "box", category: "Abrasive", notes: "For 110V sander" },
  { id: 21, name: "Abrasive Disc 110V #40 ø100", quantity: 0, unit: "pcs", category: "Abrasive", notes: "φ100mm alumina, 20pcs pack" },
  { id: 22, name: "Abrasive Disc 110V #80 ø100", quantity: 0, unit: "pcs", category: "Abrasive", notes: "φ100mm alumina, 20pcs pack" },
  { id: 23, name: "Fibroflex Disc 125mm (FikroFlex)", quantity: 0, unit: "pcs", category: "Abrasive", notes: "5\" fibre backing disc" },
  { id: 24, name: "Endless Belt 10×330mm #40 (KYOCERA)", quantity: 0, unit: "set", category: "Abrasive", notes: "For detail sanding" },
  { id: 25, name: "Endless Belt 10×330mm #80 (KYOCERA)", quantity: 0, unit: "set", category: "Abrasive", notes: "For detail sanding" },
  { id: 26, name: "Diamond Cutting Wheel ø125 (Gude)", quantity: 0, unit: "pcs", category: "Abrasive", notes: "φ125mm" },
  { id: 27, name: "Support Disc 125mm (Grinder)", quantity: 0, unit: "pcs", category: "Abrasive", notes: "Backing pad for 125mm grinder" },
  { id: 28, name: "Support Disc 150mm (Festool)", quantity: 0, unit: "pcs", category: "Abrasive", notes: "Backing pad for Festool 150mm" },

  // ─── APPLICATION TOOLS ───────────────────────────────────────
  { id: 30, name: "Brush 100mm (4 inch)", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Lamination brush" },
  { id: 31, name: "Brush 76mm (3 inch)", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Lamination brush" },
  { id: 32, name: "Brush 50mm (2 inch)", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Detail brush" },
  { id: 33, name: "Vestan Refill 140mm", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Roller refill 140mm" },
  { id: 34, name: "PE Angle Refill 100mm (Lamme)", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Corner roller refill 100mm" },
  { id: 35, name: "Urethane Roller 100mm Mohair", quantity: 0, unit: "pcs", category: "Application Tool", notes: "4 inch mohair roller" },
  { id: 36, name: "Urethane Roller 150mm", quantity: 0, unit: "pcs", category: "Application Tool", notes: "6 inch roller" },
  { id: 37, name: "Handle for 100mm Roller (Red Long)", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Long handle for 100mm rollers" },
  { id: 38, name: "Handle for 140mm Roller (Red Short)", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Short handle for 140mm rollers" },
  { id: 39, name: "Aluminium Roller (Blue Handle)", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Alu consolidation roller" },
  { id: 85, name: "Plastic Filling Knife", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Flexible plastic spatula" },
  { id: 86, name: "Japan Filling Knife", quantity: 0, unit: "pcs", category: "Application Tool", notes: "Steel finishing knife" },

  // ─── PPE ─────────────────────────────────────────────────────
  { id: 41, name: "Dust Suit Micro 2000 XL", quantity: 0, unit: "pcs", category: "PPE", notes: "Disposable coverall XL" },
  { id: 42, name: "Dust Suit Micro 2000 XXL", quantity: 0, unit: "pcs", category: "PPE", notes: "Disposable coverall XXL" },
  { id: 43, name: "Dust Suit Micro 2000 3XL", quantity: 0, unit: "pcs", category: "PPE", notes: "Disposable coverall 3XL" },
  { id: 45, name: "Dust Suit Micro 2000+ Comfort XL", quantity: 0, unit: "pcs", category: "PPE", notes: "Comfort coverall XL" },
  { id: 46, name: "Dust Suit Micro 2000+ Comfort XXL", quantity: 0, unit: "pcs", category: "PPE", notes: "Comfort coverall XXL" },
  { id: 47, name: "Dust Suit Micro 2000+ Comfort 3XL", quantity: 0, unit: "pcs", category: "PPE", notes: "Comfort coverall 3XL" },
  { id: 49, name: "3M Mask DS2 (8805)", quantity: 0, unit: "box", category: "PPE", notes: "10pcs per box" },
  { id: 50, name: "Protective Sleeves", quantity: 0, unit: "set", category: "PPE", notes: "2pcs per set" },
  { id: 51, name: "Rubber Gloves L", quantity: 0, unit: "box", category: "PPE", notes: "Chemical resistant, size L" },
  { id: 52, name: "Rubber Gloves XL", quantity: 0, unit: "box", category: "PPE", notes: "Chemical resistant, size XL" },
  { id: 53, name: "Mechanic Gloves L", quantity: 0, unit: "box", category: "PPE", notes: "Size L" },
  { id: 54, name: "Mechanic Gloves XL", quantity: 0, unit: "box", category: "PPE", notes: "Size XL" },
  { id: 55, name: "Leather Gloves L", quantity: 0, unit: "pcs", category: "PPE", notes: "Size L" },
  { id: 56, name: "Leather Gloves XL", quantity: 0, unit: "pcs", category: "PPE", notes: "Size XL" },
  { id: 57, name: "Anti-Vibration Gloves L", quantity: 0, unit: "pcs", category: "PPE", notes: "Size L" },
  { id: 58, name: "Anti-Vibration Gloves XL", quantity: 0, unit: "pcs", category: "PPE", notes: "Size XL" },
  { id: 59, name: "Work Gloves Size 10", quantity: 0, unit: "pcs", category: "PPE", notes: "General work gloves" },
  { id: 60, name: "Chemical Gloves Size 9", quantity: 0, unit: "pcs", category: "PPE", notes: "Chemical resistant size 9" },
  { id: 61, name: "Chemical Gloves Size 10", quantity: 0, unit: "pcs", category: "PPE", notes: "Chemical resistant size 10" },
  { id: 62, name: "Earplugs", quantity: 0, unit: "pcs", category: "PPE", notes: "Disposable foam earplugs" },
  { id: 63, name: "Filter 3M A2 Set (Nr:6055)", quantity: 0, unit: "set", category: "PPE", notes: "Gas filter set" },
  { id: 64, name: "3M Pro 2000 Combi Filter CF32", quantity: 0, unit: "pcs", category: "PPE", notes: "Combination filter" },
  { id: 65, name: "Gas Filter SR 518 A2", quantity: 0, unit: "set", category: "PPE", notes: "2pcs per set" },
  { id: 66, name: "Particle Filter SR 510 P3R", quantity: 0, unit: "pcs", category: "PPE", notes: "P3 particle filter" },
  { id: 67, name: "Protective Eyewear Clear", quantity: 0, unit: "pcs", category: "PPE", notes: "Clear lens safety glasses" },
  { id: 68, name: "Protective Eyewear Black", quantity: 0, unit: "pcs", category: "PPE", notes: "Tinted lens safety glasses" },

  // ─── TAPE & MASKING ──────────────────────────────────────────
  { id: 69, name: "3M Masking Tape 30mm (243J Plus)", quantity: 0, unit: "pcs", category: "Tape", notes: "30mm × 18m, 4 rolls per pack" },
  { id: 70, name: "Crepe Tape 50mm", quantity: 0, unit: "pcs", category: "Tape", notes: "50mm crepe masking tape" },
  { id: 71, name: "Plastic Tape 50mm (No.733)", quantity: 0, unit: "pcs", category: "Tape", notes: "50mm × 25m" },
  { id: 72, name: "Aluminium Tape 50mm", quantity: 0, unit: "pcs", category: "Tape", notes: "0.5mm × 50mm × 5m" },
  { id: 139, name: "3M Leading Edge Tape LM 254×33mm", quantity: 0, unit: "box", category: "Tape", notes: "Leading edge protection tape" },
  { id: 140, name: "3M Leading Edge Tape 150mm×33m (W8750)", quantity: 0, unit: "box", category: "Tape", notes: "150mm wide roll" },
  { id: 141, name: "3M Leading Edge Tape 305mm×33m (W8750)", quantity: 0, unit: "box", category: "Tape", notes: "305mm wide roll" },
  { id: 143, name: "Zig Zag Tape LM 14m/roll", quantity: 0, unit: "box", category: "Tape", notes: "LM zig-zag erosion tape" },
  { id: 186, name: "Tacky Tape Sealer Black (15m/roll)", quantity: 0, unit: "pcs", category: "Tape", notes: "Vacuum bag sealer tape" },

  // ─── MIXING & MEASURING ──────────────────────────────────────
  { id: 75, name: "Multimix Cup 1400ml", quantity: 0, unit: "pcs", category: "Consumable", notes: "1100ml mixing cup" },
  { id: 76, name: "Multimix Cup 750ml", quantity: 0, unit: "pcs", category: "Consumable", notes: "600ml mixing cup" },
  { id: 77, name: "Measuring Cup 1000ml", quantity: 0, unit: "pcs", category: "Consumable", notes: "1L graduated cup" },
  { id: 78, name: "Measuring Cup 500ml", quantity: 0, unit: "pcs", category: "Consumable", notes: "500ml graduated cup" },
  { id: 79, name: "Measuring Cup 300ml", quantity: 0, unit: "pcs", category: "Consumable", notes: "300ml graduated cup" },
  { id: 80, name: "Plastic Bucket 5L", quantity: 0, unit: "pcs", category: "Consumable", notes: "5L mixing bucket" },
  { id: 81, name: "Lid for 5L Bucket", quantity: 0, unit: "pcs", category: "Consumable", notes: "Snap lid for 5L bucket" },
  { id: 83, name: "Dispenser Bottle", quantity: 0, unit: "pcs", category: "Consumable", notes: "For acetone/solvent dispensing" },
  { id: 84, name: "Stirring Stick 300mm", quantity: 0, unit: "pcs", category: "Consumable", notes: "Wooden mixing sticks" },
  { id: 87, name: "ECON Araldite Applicator Gun", quantity: 0, unit: "pcs", category: "Consumable", notes: "Manual cartridge applicator" },
  { id: 88, name: "Empty Plastic Cartridges", quantity: 0, unit: "pcs", category: "Consumable", notes: "For 2-part adhesive" },
  { id: 89, name: "End Piece for Cartridge", quantity: 0, unit: "pcs", category: "Consumable", notes: "Cartridge end cap" },
  { id: 90, name: "Plastic Tip for Cartridge", quantity: 0, unit: "pcs", category: "Consumable", notes: "Mixing nozzle tip" },
  { id: 91, name: "Plastic Bag Cone", quantity: 0, unit: "set", category: "Consumable", notes: "50pcs per set" },

  // ─── RESIN & HARDENER ────────────────────────────────────────
  { id: 192, name: "Resin 5kg", quantity: 0, unit: "can", category: "Resin", notes: "General lamination resin, 5kg bucket" },
  { id: 196, name: "MEKP Hardener 500ml", quantity: 0, unit: "pcs", category: "Resin", notes: "Catalyst for polyester resin" },
  { id: 197, name: "Ampreg 30 Standard Set 4.66kg", quantity: 0, unit: "set", category: "Resin", notes: "Epoxy resin set, standard cure" },
  { id: 198, name: "Ampreg 30 Fast Set 4.66kg", quantity: 0, unit: "set", category: "Resin", notes: "Epoxy resin set, fast cure" },
  { id: 199, name: "Ampreg 30 Slow Set 4.66kg", quantity: 0, unit: "set", category: "Resin", notes: "Epoxy resin set, slow cure" },
  { id: 193, name: "Gelcoat 7035 5kg", quantity: 0, unit: "can", category: "Resin", notes: "Gelcoat for surface finish, 5kg" },
  { id: 195, name: "No-Stick Release Agent 1L", quantity: 0, unit: "can", category: "Resin", notes: "Mould release agent" },

  // ─── FILLER ──────────────────────────────────────────────────
  { id: 200, name: "Würth Finspartel Vaku 30 Set 1.96kg", quantity: 0, unit: "set", category: "Filler", notes: "Vacuum filler set 30, 1.96kg" },
  { id: 201, name: "Würth Finspartel Vaku 70 Set 1.76kg", quantity: 0, unit: "set", category: "Filler", notes: "Vacuum filler set 70, 1.76kg" },
  { id: 232, name: "Alexit BladeRep Profile Filler 5 — 0.25kg", quantity: 0, unit: "can", category: "Filler", notes: "BR5F66 small can" },
  { id: 233, name: "Alexit BladeRep Hardener 5 — 0.1kg", quantity: 0, unit: "can", category: "Filler", notes: "BR5FH2 small hardener" },
  { id: 234, name: "Alexit BladeRep Profile Filler 5 — 4kg", quantity: 0, unit: "can", category: "Filler", notes: "BR5F66 large can" },
  { id: 235, name: "Alexit BladeRep Hardener 5 — 1kg", quantity: 0, unit: "can", category: "Filler", notes: "BR5FH2 large hardener" },
  { id: 236, name: "Alexit BladeRep Profile Filler 7R 400ml", quantity: 0, unit: "pcs", category: "Filler", notes: "BR7R31 cartridge" },
  { id: 237, name: "Static Mixer for Filler 7B/7R (MFH 10-24T)", quantity: 0, unit: "pcs", category: "Filler", notes: "Mixing nozzle for Filler 7 series" },

  // ─── ADHESIVE ────────────────────────────────────────────────
  { id: 194, name: "Enguard VE Glue 5kg", quantity: 0, unit: "can", category: "Adhesive", notes: "Vinyl ester structural adhesive" },
  { id: 203, name: "Araldite 2021 50ml Type 1", quantity: 0, unit: "pcs", category: "Adhesive", notes: "0.05kg cartridge with nozzle" },
  { id: 204, name: "Araldite 2021 Mixing Tubes Type 1", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Replacement nozzles" },
  { id: 205, name: "Araldite 2021 50ml Type 2", quantity: 0, unit: "pcs", category: "Adhesive", notes: "0.05kg cartridge with nozzle" },
  { id: 206, name: "Araldite 2021 Mixing Tubes Type 2", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Replacement nozzles" },
  { id: 207, name: "Araldite 2021 380ml Type 3", quantity: 0, unit: "pcs", category: "Adhesive", notes: "0.38kg cartridge with nozzle" },
  { id: 208, name: "Araldite 2021 Mixing Tubes Type 3", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Replacement nozzles" },
  { id: 209, name: "MA310 Structural Adhesive 400ml", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Methacrylate adhesive" },
  { id: 210, name: "MA530 Structural Adhesive 400ml", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Methacrylate adhesive" },
  { id: 211, name: "MA560 Structural Adhesive 400ml", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Methacrylate adhesive" },
  { id: 212, name: "Mix Nozzle for MA Adhesive", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Replacement mixing nozzle" },
  { id: 213, name: "Sikaflex 521 UV Light Grey", quantity: 0, unit: "pcs", category: "Adhesive", notes: "UV resistant sealant" },
  { id: 214, name: "Sikaflex 221 310ml", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Multi-purpose sealant" },
  { id: 215, name: "Nozzle for Sikaflex 221/521", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Replacement nozzle" },
  { id: 216, name: "Sika Force 7818 L7 195ml", quantity: 0, unit: "pcs", category: "Adhesive", notes: "High strength adhesive" },
  { id: 217, name: "Nozzle for Sika Force 7818", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Replacement nozzle" },
  { id: 218, name: "Sikaflex 521 UV Sausage Pack 400ml", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Foil sausage, light grey" },
  { id: 219, name: "Sika Force 7800 Blue 195ml (A+B)", quantity: 0, unit: "pcs", category: "Adhesive", notes: "2-part adhesive" },
  { id: 220, name: "Sika Force 7800 Red 195ml (A+B)", quantity: 0, unit: "pcs", category: "Adhesive", notes: "2-part adhesive" },
  { id: 221, name: "Nozzle for Sika Force 7800", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Replacement nozzle" },
  { id: 222, name: "Spabond 340LV HT Fast 400ml", quantity: 0, unit: "pcs", category: "Adhesive", notes: "Epoxy adhesive, fast cure" },

  // ─── TOPCOAT & PRIMER ────────────────────────────────────────
  { id: 223, name: "Alexit BladeRep LEP10 BR1075", quantity: 0, unit: "pcs", category: "Topcoat", notes: "Leading edge protection coating" },
  { id: 224, name: "Nozzle for LEP10", quantity: 0, unit: "pcs", category: "Topcoat", notes: "Replacement nozzle" },
  { id: 225, name: "Brush for LEP10", quantity: 0, unit: "pcs", category: "Topcoat", notes: "Application brush" },
  { id: 226, name: "Alexit Topcoat 12 Orange RAL2009 800gr", quantity: 0, unit: "can", category: "Topcoat", notes: "BR1229 traffic orange" },
  { id: 227, name: "Alexit Topcoat 12 Light Grey RAL7035 800gr", quantity: 0, unit: "can", category: "Topcoat", notes: "BR1275 light grey" },
  { id: 228, name: "Alexit Topcoat 12 Red RAL3020 800gr", quantity: 0, unit: "can", category: "Topcoat", notes: "BR1232 red" },
  { id: 229, name: "Alexit Topcoat 12 White RAL9010 800gr", quantity: 0, unit: "can", category: "Topcoat", notes: "BR1290 pure white" },
  { id: 230, name: "Alexit BladeRep Hardener 12 — 220gr", quantity: 0, unit: "can", category: "Topcoat", notes: "Hardener for Topcoat 12 series" },
  { id: 231, name: "Alexit Thinner 12 Fast 1L", quantity: 0, unit: "pcs", category: "Topcoat", notes: "BR12T7 fast thinner" },
  { id: 239, name: "Windmastic Topcoat HS200 Kit Grey 7035", quantity: 0, unit: "set", category: "Topcoat", notes: "0.5L paint + 0.1L hardener" },
  { id: 240, name: "Windmastic Topcoat HS200 Kit White 9010", quantity: 0, unit: "set", category: "Topcoat", notes: "0.5L paint + 0.1L hardener" },
  { id: 241, name: "Windmastic Topcoat HS200 Kit Orange 2009", quantity: 0, unit: "set", category: "Topcoat", notes: "0.5L paint + 0.1L hardener" },
  { id: 247, name: "G4 Primer (Voss Chemie) 1L", quantity: 0, unit: "can", category: "Topcoat", notes: "Adhesion primer" },
  { id: 248, name: "SikaAktivator-205 250ml", quantity: 0, unit: "can", category: "Topcoat", notes: "Surface activator/primer" },
  { id: 243, name: "3M Edge Sealer Set", quantity: 0, unit: "set", category: "Topcoat", notes: "Edge sealing system" },
  { id: 244, name: "Mixing Nozzle for 3M Edge Sealer", quantity: 0, unit: "pcs", category: "Topcoat", notes: "Replacement nozzle" },
  { id: 245, name: "3M Surface Cleaner 1L", quantity: 0, unit: "pcs", category: "Topcoat", notes: "Surface prep cleaner" },
  { id: 246, name: "Acetone 16L", quantity: 0, unit: "can", category: "Topcoat", notes: "Surface cleaning solvent" },

  // ─── FIBERGLASS ──────────────────────────────────────────────
  { id: 159, name: "Fiberglass CSM 100gsm 1040mm wide", quantity: 0, unit: "kg", category: "Fiberglass", notes: "Chopped strand mat, w=1040mm" },
  { id: 160, name: "Fiberglass CSM 300gsm 550mm wide", quantity: 0, unit: "kg", category: "Fiberglass", notes: "Chopped strand mat, w=550mm" },
  { id: 161, name: "Fiberglass CSM 300gsm 1250mm wide", quantity: 0, unit: "kg", category: "Fiberglass", notes: "Chopped strand mat, w=1250mm" },
  { id: 163, name: "Fiberglass Biaxial 450gsm 1300mm", quantity: 0, unit: "kg", category: "Fiberglass", notes: "±45° biaxial fabric" },
  { id: 164, name: "Fiberglass Biaxial 600gsm 1300mm", quantity: 0, unit: "kg", category: "Fiberglass", notes: "±45° biaxial fabric" },
  { id: 165, name: "Fiberglass Biaxial 800gsm 1300mm", quantity: 0, unit: "kg", category: "Fiberglass", notes: "±45° biaxial fabric" },
  { id: 166, name: "Fiberglass Biaxial 1200gsm 1300mm", quantity: 0, unit: "kg", category: "Fiberglass", notes: "±45° heavy biaxial fabric" },
  { id: 168, name: "Fiberglass Combi 900gsm 45gr 600mm", quantity: 0, unit: "kg", category: "Fiberglass", notes: "Combination fabric w=600mm" },
  { id: 170, name: "Fiberglass Combi 900gsm 600mm", quantity: 0, unit: "kg", category: "Fiberglass", notes: "Combination fabric w=600mm" },
  { id: 171, name: "Fiberglass Combi 1250gsm 600mm", quantity: 0, unit: "kg", category: "Fiberglass", notes: "Heavy combination fabric" },
  { id: 173, name: "Fiberglass Triaxial 750gsm (Linetex)", quantity: 0, unit: "kg", category: "Fiberglass", notes: "Triaxial fabric w=1300mm" },
  { id: 174, name: "Fiberglass Triaxial 900gsm (Linetex)", quantity: 0, unit: "kg", category: "Fiberglass", notes: "Triaxial fabric w=1300mm" },
  { id: 175, name: "Fiberglass Triaxial 1200gsm (Linetex)", quantity: 0, unit: "kg", category: "Fiberglass", notes: "Heavy triaxial w=1300mm" },
  { id: 177, name: "UD661 Unidirectional (LM/GE) 1250mm", quantity: 0, unit: "kg", category: "Fiberglass", notes: "For LM blades 47.5m+" },
  { id: 178, name: "UD1322 Unidirectional (LM/GE) 1250mm", quantity: 0, unit: "kg", category: "Fiberglass", notes: "For LM blades 47.5m+" },
  { id: 180, name: "Biax830 Biaxial SAERTEX (GE/Sinoma/TPI)", quantity: 0, unit: "kg", category: "Fiberglass", notes: "w=250mm" },
  { id: 181, name: "UD970 Unidirectional SAERTEX (GE/Sinoma/TPI)", quantity: 0, unit: "kg", category: "Fiberglass", notes: "w=500mm" },

  // ─── VACUUM CONSUMABLES ──────────────────────────────────────
  { id: 183, name: "Peel Ply ECONOSTITCH 30\" (762mm×91.4m)", quantity: 0, unit: "kg", category: "Vacuum", notes: "Peel ply roll" },
  { id: 184, name: "Peel Ply ECONOSTITCH 60\" (1520mm×91.4m)", quantity: 0, unit: "kg", category: "Vacuum", notes: "Wide peel ply roll" },
  { id: 187, name: "Breather/Bleeder 3-Combi 1×152m (1000mm)", quantity: 0, unit: "m", category: "Vacuum", notes: "Vacuum infusion breather" },
  { id: 188, name: "BREATEX 300 Breather (1.52m×50m)", quantity: 0, unit: "kg", category: "Vacuum", notes: "w=1520mm" },
  { id: 189, name: "Spiralflex Spiral Tube 10×12mm (100m)", quantity: 0, unit: "m", category: "Vacuum", notes: "Resin infusion channel tube" },
  { id: 190, name: "Vacuum Film 4m×200m", quantity: 0, unit: "m", category: "Vacuum", notes: "w=4000mm vacuum bagging film" },

  // ─── CORE MATERIALS ──────────────────────────────────────────
  { id: 150, name: "PVC Foam H60 10mm", quantity: 0, unit: "pcs", category: "Core", notes: "Structural foam core 10mm" },
  { id: 151, name: "PVC Foam H60 20mm", quantity: 0, unit: "pcs", category: "Core", notes: "Structural foam core 20mm" },
  { id: 152, name: "PVC Foam H60 25mm", quantity: 0, unit: "pcs", category: "Core", notes: "Structural foam core 25mm" },
  { id: 154, name: "Balsa Wood 10mm", quantity: 0, unit: "pcs", category: "Core", notes: "Balsa core panel 10mm" },
  { id: 155, name: "Balsa Wood 15mm", quantity: 0, unit: "pcs", category: "Core", notes: "Balsa core panel 15mm" },
  { id: 156, name: "Balsa Wood 20mm", quantity: 0, unit: "pcs", category: "Core", notes: "Balsa core panel 20mm" },
  { id: 157, name: "Balsa Wood 25mm", quantity: 0, unit: "pcs", category: "Core", notes: "Balsa core panel 25mm" },

  // ─── LIGHTNING PROTECTION ────────────────────────────────────
  { id: 93,  name: "Receptor Seal 0.5mm", quantity: 0, unit: "pcs", category: "Lightning", notes: "Sealing gasket for receptor" },
  { id: 94,  name: "Receptor Seal 1.0mm", quantity: 0, unit: "pcs", category: "Lightning", notes: "Sealing gasket for receptor" },
  { id: 97,  name: "Lightning Receptor LM34.0 (33.7, 8×10mm)", quantity: 0, unit: "pcs", category: "Lightning", notes: "Standard LM receptor" },
  { id: 102, name: "Lightning Cable", quantity: 0, unit: "m", category: "Lightning", notes: "Down conductor cable" },
  { id: 103, name: "Terminal for Anchor Block 90gr (S)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 104, name: "Lightning Cable Joint Connector", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 106, name: "Tungsten Receptor 18.5mm (10×18.5mm)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 107, name: "Tungsten Receptor 22mm (10×22mm)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 108, name: "Tungsten Receptor 26.5mm (10×26.5mm)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 109, name: "Tungsten Receptor 32mm (10×32mm)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 110, name: "Tungsten Receptor 52mm (10×52mm)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 111, name: "Tungsten Receptor 58mm (10×58mm)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 112, name: "Tungsten Receptor 63mm (10×63mm)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 118, name: "Vestas Receptor M16.4 × 19mm", quantity: 0, unit: "pcs", category: "Lightning", notes: "Vestas specific receptor" },
  { id: 119, name: "Vestas Receptor M16.4 × 35mm", quantity: 0, unit: "pcs", category: "Lightning", notes: "Vestas specific receptor" },
  { id: 120, name: "Vestas Receptor M16.4 × 45mm", quantity: 0, unit: "pcs", category: "Lightning", notes: "Vestas specific receptor" },
  { id: 121, name: "Vestas Receptor M16.4 × 55mm", quantity: 0, unit: "pcs", category: "Lightning", notes: "Vestas specific receptor" },
  { id: 123, name: "Tipdrain Receptor", quantity: 0, unit: "pcs", category: "Lightning", notes: "Tip drain receptor assembly" },
  { id: 124, name: "Tungsten Tipdrain Receptor (R18×137)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 125, name: "Lightning Receptor 30mm", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 126, name: "Lightning Receptor 45mm", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 127, name: "Lightning Receptor 56mm", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 128, name: "Tip Anchor Block LM (with drain)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 129, name: "Block Assy Tip 2×Level 1 (with tipdrain)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 130, name: "Receptor Base", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 131, name: "Lightning Terminal (Flexibar/Cable)", quantity: 0, unit: "pcs", category: "Lightning", notes: "" },
  { id: 132, name: "Flexibar Insulated CU/SN 3×24×1000mm", quantity: 0, unit: "m", category: "Lightning", notes: "" },

  // ─── VORTEX GENERATORS ───────────────────────────────────────
  { id: 134, name: "Vestas Vortex 3mm (240×20)", quantity: 0, unit: "pcs", category: "Vortex Generator", notes: "" },
  { id: 135, name: "Vestas Vortex 6mm (220×30)", quantity: 0, unit: "pcs", category: "Vortex Generator", notes: "" },
  { id: 136, name: "Vortex Generator LM Small", quantity: 0, unit: "pcs", category: "Vortex Generator", notes: "" },
  { id: 137, name: "MWT1000 Vortex Generator Kit 15mm VG", quantity: 0, unit: "pcs", category: "Vortex Generator", notes: "" },
  { id: 138, name: "MWT1000 Vortex Generator Kit 10mm VG", quantity: 0, unit: "pcs", category: "Vortex Generator", notes: "" },

  // ─── WASTE & GENERAL ─────────────────────────────────────────
  { id: 147, name: "Garbage Bags Translucent 70L", quantity: 0, unit: "box", category: "Consumable", notes: "10pcs per box" },
  { id: 148, name: "SAEK Garbage Bag 700×1100mm", quantity: 0, unit: "pcs", category: "Consumable", notes: "10pcs per pack" },
  { id: 73,  name: "Festool Cable H05RN-F 2×1 4m", quantity: 0, unit: "pcs", category: "Consumable", notes: "Replacement power cable" },
];

const CATEGORY_OPTIONS = [
  "Abrasive",
  "Adhesive",
  "Application Tool",
  "Consumable",
  "Core",
  "Fiberglass",
  "Filler",
  "Lightning",
  "PPE",
  "Resin",
  "Tape",
  "Topcoat",
  "Vacuum",
  "Vortex Generator",
];

function App() {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-items");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge: keep saved quantities/edits for matching IDs, add any new items from INITIAL_ITEMS
        const savedMap = new Map(parsed.map((item) => [item.id, item]));
        const merged = INITIAL_ITEMS.map((init) => {
          const existing = savedMap.get(init.id);
          return existing ? { ...init, ...existing } : init;
        });
        // Also keep any user-added items (IDs not in INITIAL_ITEMS)
        const initialIds = new Set(INITIAL_ITEMS.map((i) => i.id));
        const userAdded = parsed.filter((item) => !initialIds.has(item.id));
        return [...merged, ...userAdded];
      }
      return INITIAL_ITEMS;
    } catch {
      return INITIAL_ITEMS;
    }
  });
  const [jobHistory, setJobHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-jobs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-projects");
      let parsed = saved ? JSON.parse(saved) : [];
      // One-time migration: move damageStatuses from localStorage into damage objects
      const oldStatuses = localStorage.getItem("vetra-damage-statuses");
      if (oldStatuses) {
        try {
          const statusMap = JSON.parse(oldStatuses);
          if (Object.keys(statusMap).length > 0) {
            parsed = parsed.map((project) => ({
              ...project,
              turbines: (project.turbines || []).map((turbine) => ({
                ...turbine,
                blades: (turbine.blades || []).map((blade) => ({
                  ...blade,
                  damages: (blade.damages || []).map((damage) => {
                    if (damage.status) return damage; // already migrated
                    const dKey = `${damage.number}::${damage.type}::${damage.radius || ""}::${(damage.locations || []).join(",")}`;
                    const statusKey = `${turbine.name}::${blade.name}::${dKey}`;
                    const migratedStatus = statusMap[statusKey] || "notstarted";
                    return { ...damage, status: migratedStatus };
                  }),
                })),
              })),
            }));
          }
        } catch {}
        localStorage.removeItem("vetra-damage-statuses");
      } else {
        // Ensure all damages have a status field
        parsed = parsed.map((project) => ({
          ...project,
          turbines: (project.turbines || []).map((turbine) => ({
            ...turbine,
            blades: (turbine.blades || []).map((blade) => ({
              ...blade,
              damages: (blade.damages || []).map((damage) =>
                damage.status ? damage : { ...damage, status: "notstarted" }
              ),
            })),
          })),
        }));
      }
      return parsed;
    } catch {
      return [];
    }
  });
  const [activeProjectId, setActiveProjectId] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-active-project-id");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [timesheets, setTimesheets] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-timesheet");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [auditLog, setAuditLog] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-audit-log");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    try { return localStorage.getItem("vetra-inv-search") || ""; } catch { return ""; }
  });
  const [categoryFilter, setCategoryFilter] = useState(() => {
    try { return localStorage.getItem("vetra-inv-category") || "All"; } catch { return "All"; }
  });
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem("vetra-inv-sort") || "name"; } catch { return "name"; }
  });

  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCategory, setNewCategory] = useState("Resin");
  const [newNotes, setNewNotes] = useState("");
  const [newMinStock, setNewMinStock] = useState("");
  const [newBatchNumber, setNewBatchNumber] = useState("");
  const [newExpiryDate, setNewExpiryDate] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("vetra-items", JSON.stringify(items));
    } catch {}
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem("vetra-jobs", JSON.stringify(jobHistory));
    } catch {}
  }, [jobHistory]);

  useEffect(() => {
    try {
      localStorage.setItem("vetra-projects", JSON.stringify(projects));
    } catch {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "vetra-active-project-id",
        JSON.stringify(activeProjectId)
      );
    } catch {}
  }, [activeProjectId]);

  useEffect(() => {
    try {
      localStorage.setItem("vetra-timesheet", JSON.stringify(timesheets));
    } catch {}
  }, [timesheets]);

  useEffect(() => {
    try {
      localStorage.setItem("vetra-audit-log", JSON.stringify(auditLog));
    } catch {}
  }, [auditLog]);

  useEffect(() => {
    try { localStorage.setItem("vetra-inv-search", searchTerm); } catch {}
  }, [searchTerm]);

  useEffect(() => {
    try { localStorage.setItem("vetra-inv-category", categoryFilter); } catch {}
  }, [categoryFilter]);

  useEffect(() => {
    try { localStorage.setItem("vetra-inv-sort", sortBy); } catch {}
  }, [sortBy]);

  const activeProject =
    projects.find((project) => project.id === activeProjectId) || null;

  const setProjectName = (name) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId ? { ...project, name } : project
      )
    );
  };

  const addProject = (name) => {
    const newProject = {
      id: Date.now() + Math.random(),
      name,
      status: "active",
      client: "",
      windFarm: "",
      location: "",
      projectRef: "",
      turbineModel: "",
      bladeType: "",
      team: "",
      projectNotes: "",
      turbines: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
  };

  const deleteProject = (projectId) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
  };

  const updateProject = (projectId, fields) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, ...fields } : p))
    );
  };

  const archiveProject = (projectId) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, status: "archived" } : project
      )
    );
  };

  const unarchiveProject = (projectId) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, status: "active" } : project
      )
    );
  };

  const switchActiveProject = (projectId) => {
    setActiveProjectId(projectId);
  };

  const addTurbine = (name) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: [
                ...project.turbines,
                { id: Date.now() + Math.random(), name, serial: "", hubHeight: "", sitePosition: "", blades: [] },
              ],
            }
          : project
      )
    );
  };

  const deleteTurbine = (turbineId) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.filter((t) => t.id !== turbineId),
            }
          : project
      )
    );
  };

  const updateTurbine = (turbineId, fields) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((t) =>
                t.id === turbineId ? { ...t, ...fields } : t
              ),
            }
          : project
      )
    );
  };

  const addBlade = (turbineId, bladeName) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((turbine) =>
                turbine.id === turbineId
                  ? {
                      ...turbine,
                      blades: [
                        ...turbine.blades,
                        {
                          id: Date.now() + Math.random(),
                          name: bladeName,
                          serial: "",
                          bladeLength: "",
                          damages: [],
                        },
                      ],
                    }
                  : turbine
              ),
            }
          : project
      )
    );
  };

  const deleteBlade = (turbineId, bladeId) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((turbine) =>
                turbine.id === turbineId
                  ? {
                      ...turbine,
                      blades: turbine.blades.filter((b) => b.id !== bladeId),
                    }
                  : turbine
              ),
            }
          : project
      )
    );
  };

  const updateBlade = (turbineId, bladeId, fields) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((t) =>
                t.id === turbineId
                  ? {
                      ...t,
                      blades: t.blades.map((b) =>
                        b.id === bladeId ? { ...b, ...fields } : b
                      ),
                    }
                  : t
              ),
            }
          : project
      )
    );
  };

  const addDamage = (turbineId, bladeId) => {
    const newId = Date.now() + Math.random();
    if (!activeProjectId) return newId;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((turbine) => {
                if (turbine.id !== turbineId) return turbine;
                return {
                  ...turbine,
                  blades: turbine.blades.map((blade) => {
                    if (blade.id !== bladeId) return blade;
                    const nextIndex = blade.damages.length + 1;
                    const newDamage = {
                      id: newId,
                      number: `D${nextIndex}`,
                      type: "Erosion",
                      severity: "",
                      radius: "",
                      locations: [],
                      notes: "",
                      status: "notstarted",
                    };
                    return {
                      ...blade,
                      damages: [...blade.damages, newDamage],
                    };
                  }),
                };
              }),
            }
          : project
      )
    );
    return newId;
  };

  const updateDamage = (turbineId, bladeId, damageId, fields) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((turbine) => {
                if (turbine.id !== turbineId) return turbine;
                return {
                  ...turbine,
                  blades: turbine.blades.map((blade) => {
                    if (blade.id !== bladeId) return blade;
                    return {
                      ...blade,
                      damages: blade.damages.map((damage) =>
                        damage.id === damageId
                          ? { ...damage, ...fields }
                          : damage
                      ),
                    };
                  }),
                };
              }),
            }
          : project
      )
    );
  };

  const deleteDamage = (turbineId, bladeId, damageId) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((t) => {
                if (t.id !== turbineId) return t;
                return {
                  ...t,
                  blades: t.blades.map((b) => {
                    if (b.id !== bladeId) return b;
                    return {
                      ...b,
                      damages: b.damages.filter((d) => d.id !== damageId),
                    };
                  }),
                };
              }),
            }
          : project
      )
    );
  };

  const duplicateTurbine = (turbineId) => {
    if (!activeProjectId) return;
    let idCounter = Date.now();
    const genId = () => ++idCounter + Math.random();
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== activeProjectId) return project;
        const source = project.turbines.find((t) => t.id === turbineId);
        if (!source) return project;
        const copy = {
          id: genId(),
          name: source.name + " (copy)",
          serial: source.serial || "",
          hubHeight: source.hubHeight || "",
          sitePosition: source.sitePosition || "",
          blades: source.blades.map((blade) => ({
            id: genId(),
            name: blade.name,
            serial: blade.serial || "",
            bladeLength: blade.bladeLength || "",
            damages: blade.damages.map((d) => ({
              ...d,
              id: genId(),
              status: "notstarted",
            })),
          })),
        };
        return { ...project, turbines: [...project.turbines, copy] };
      })
    );
  };

  const addMultipleBlades = (turbineId, names) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== activeProjectId) return project;
        return {
          ...project,
          turbines: project.turbines.map((turbine) => {
            if (turbine.id !== turbineId) return turbine;
            const existingNames = new Set(turbine.blades.map((b) => b.name));
            const newBlades = names
              .filter((n) => !existingNames.has(n))
              .map((n) => ({
                id: Date.now() + Math.random() + names.indexOf(n),
                name: n,
                serial: "",
                bladeLength: "",
                damages: [],
              }));
            if (newBlades.length === 0) return turbine;
            return { ...turbine, blades: [...turbine.blades, ...newBlades] };
          }),
        };
      })
    );
  };

  // Consumed per inventory item for the active project
  const consumedByProject = useMemo(() => {
    if (!activeProjectId) return {};
    const result = {};
    jobHistory.forEach((job) => {
      if (job.projectId !== activeProjectId) return;
      const allMats = [
        ...(job.materials || []),
        ...(job.operations || []).flatMap((op) => op.materials || []),
      ];
      allMats.forEach((m) => {
        const key = Number(m.itemId);
        result[key] = (result[key] || 0) + Number(m.amount || 0);
      });
    });
    return result;
  }, [jobHistory, activeProjectId]);

  // Consumed across ALL projects (total)
  const consumedTotal = useMemo(() => {
    const result = {};
    jobHistory.forEach((job) => {
      const allMats = [
        ...(job.materials || []),
        ...(job.operations || []).flatMap((op) => op.materials || []),
      ];
      allMats.forEach((m) => {
        const key = Number(m.itemId);
        result[key] = (result[key] || 0) + Number(m.amount || 0);
      });
    });
    return result;
  }, [jobHistory]);

  const addAuditEntry = (entry) => {
    setAuditLog((prev) => {
      const next = [{ ...entry, timestamp: new Date().toISOString() }, ...prev];
      return next.length > 500 ? next.slice(0, 500) : next;
    });
  };

  const handleAdjustQuantity = (id, delta) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newQty = Math.max(0, item.quantity + delta);
        addAuditEntry({ type: "adjust", itemId: id, itemName: item.name, from: item.quantity, to: newQty, delta });
        return { ...item, quantity: newQty };
      })
    );
  };

  const handleSetQuantity = (id, value) => {
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        addAuditEntry({ type: "set", itemId: id, itemName: item.name, from: item.quantity, to: num });
        return { ...item, quantity: num };
      })
    );
  };

  const handleUpdateItem = (id, fields) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...fields } : item
      )
    );
  };

  const handleDelete = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRestoreItem = (item) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const editJob = (oldJob, newJob) => {
    setItems((prev) => {
      let updated = [...prev];

      const oldMats = [
        ...(oldJob.materials || []),
        ...(oldJob.operations || []).flatMap((op) => op.materials || []),
      ];
      oldMats.forEach((mat) => {
        const idx = updated.findIndex((i) => i.id === Number(mat.itemId));
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            quantity:
              (updated[idx].quantity || 0) + Number(mat.amount || 0),
          };
        }
      });

      const newMats = [
        ...(newJob.materials || []),
        ...(newJob.operations || []).flatMap((op) => op.materials || []),
      ];
      newMats.forEach((mat) => {
        const idx = updated.findIndex((i) => i.id === Number(mat.itemId));
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            quantity: Math.max(
              0,
              (updated[idx].quantity || 0) - Number(mat.amount || 0)
            ),
          };
        }
      });

      return updated;
    });

    setJobHistory((prev) =>
      prev.map((j) => (j.id === newJob.id ? newJob : j))
    );
  };

  const deleteJob = (job) => {
    // Reverse material deductions
    setItems((prev) => {
      const updated = [...prev];
      const allMats = [
        ...(job.materials || []),
        ...(job.operations || []).flatMap((op) => op.materials || []),
      ];
      allMats.forEach((mat) => {
        const idx = updated.findIndex((i) => i.id === Number(mat.itemId));
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            quantity: (updated[idx].quantity || 0) + Number(mat.amount || 0),
          };
        }
      });
      return updated;
    });
    setJobHistory((prev) => prev.filter((j) => j.id !== job.id));
  };

  const handleAddItem = (e) => {
    e.preventDefault();

    const trimmedName = newName.trim();
    if (!trimmedName) {
      return;
    }

    const parsedQuantity = Number(newQuantity);
    const safeQuantity = Number.isNaN(parsedQuantity) || parsedQuantity < 0 ? 0 : parsedQuantity;

    const nextId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;

    const parsedMinStock = Number(newMinStock);
    const safeMinStock = Number.isNaN(parsedMinStock) || parsedMinStock < 0 ? 0 : parsedMinStock;

    const newItem = {
      id: nextId,
      name: trimmedName,
      quantity: safeQuantity,
      unit: newUnit || "",
      category: newCategory || "Other",
      notes: newNotes || "",
      minStock: safeMinStock,
      batchNumber: newBatchNumber || "",
      expiryDate: newExpiryDate || "",
      stockAlert: safeMinStock > 0,
    };

    setItems((prev) => [...prev, newItem]);
    addAuditEntry({ type: "add", itemId: nextId, itemName: trimmedName, quantity: safeQuantity });

    setNewName("");
    setNewQuantity("");
    setNewUnit("");
    setNewCategory("Resin");
    setNewNotes("");
    setNewMinStock("");
    setNewBatchNumber("");
    setNewExpiryDate("");
  };

  const filteredItems = items
    .filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        categoryFilter === "All" ? true : item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "quantity":
          return a.quantity - b.quantity;
        case "category":
          return a.category.localeCompare(b.category);
        case "status": {
          const rank = (item) => {
            if (item.quantity === 0) return 0;
            if (item.minStock > 0 && item.quantity <= item.minStock) return 1;
            return 2;
          };
          return rank(a) - rank(b);
        }
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const getStockStatusClass = (item) => {
    if (!item.stockAlert) return "";
    if (item.quantity === 0) return "card-low";
    if (item.minStock > 0 && item.quantity <= item.minStock) return "card-warning";
    return "";
  };

  return (
    <BrowserRouter>
      <div className="app-root">
        <NavBar activeProject={activeProject} />
        <Routes>
          <Route
            path="/"
            element={
              <InventoryPage
                items={items}
                filteredItems={filteredItems}
                categoryOptions={CATEGORY_OPTIONS}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                newName={newName}
                setNewName={setNewName}
                newQuantity={newQuantity}
                setNewQuantity={setNewQuantity}
                newUnit={newUnit}
                setNewUnit={setNewUnit}
                newCategory={newCategory}
                setNewCategory={setNewCategory}
                newNotes={newNotes}
                setNewNotes={setNewNotes}
                newMinStock={newMinStock}
                setNewMinStock={setNewMinStock}
                newBatchNumber={newBatchNumber}
                setNewBatchNumber={setNewBatchNumber}
                newExpiryDate={newExpiryDate}
                setNewExpiryDate={setNewExpiryDate}
                handleAddItem={handleAddItem}
                handleAdjustQuantity={handleAdjustQuantity}
                handleSetQuantity={handleSetQuantity}
                handleUpdateItem={handleUpdateItem}
                handleDelete={handleDelete}
                handleRestoreItem={handleRestoreItem}
                getStockStatusClass={getStockStatusClass}
                consumedByProject={consumedByProject}
                consumedTotal={consumedTotal}
                activeProjectName={activeProject?.name || null}
                jobHistory={jobHistory}
                activeProjectId={activeProjectId}
                projects={projects}
                sortBy={sortBy}
                setSortBy={setSortBy}
                auditLog={auditLog}
              />
            }
          />
          <Route
            path="/jobs"
            element={
              <JobLogPage
                items={items}
                project={activeProject}
                projects={projects}
                jobHistory={jobHistory}
                timesheets={timesheets}
                setTimesheets={setTimesheets}
                onUpdateDamage={updateDamage}
                onSubmitJob={(job) => {
                  setItems((prevItems) => {
                    const updated = [...prevItems];
                    const applyDeduction = (mat) => {
                      const index = updated.findIndex(
                        (i) => i.id === mat.itemId
                      );
                      if (index === -1) return;
                      const current = updated[index];
                      const newQuantity = Math.max(
                        0,
                        (current.quantity || 0) - mat.amount
                      );
                      updated[index] = { ...current, quantity: newQuantity };
                    };
                    (job.materials || []).forEach(applyDeduction);
                    (job.operations || []).forEach((op) =>
                      (op.materials || []).forEach(applyDeduction)
                    );
                    return updated;
                  });
                  setJobHistory((prev) => [job, ...prev]);
                }}
                onEditJob={editJob}
                onDeleteJob={deleteJob}
              />
            }
          />
          <Route
            path="/dashboard"
            element={
              <DamageDashboard
                project={activeProject}
                projects={projects}
                items={items}
                jobHistory={jobHistory}
                timesheets={timesheets}
                getStockStatusClass={getStockStatusClass}
                onUpdateDamage={updateDamage}
                standalone
              />
            }
          />
          <Route
            path="/setup"
            element={
              <ProjectSetupPage
                projects={projects}
                activeProjectId={activeProjectId}
                activeProject={activeProject}
                onAddProject={addProject}
                onDeleteProject={deleteProject}
                onArchiveProject={archiveProject}
                onUnarchiveProject={unarchiveProject}
                onSwitchActiveProject={switchActiveProject}
                onSetProjectName={setProjectName}
                onAddTurbine={addTurbine}
                onUpdateTurbine={updateTurbine}
                onDeleteTurbine={deleteTurbine}
                onAddBlade={addBlade}
                onUpdateBlade={updateBlade}
                onDeleteBlade={deleteBlade}
                onAddDamage={addDamage}
                onUpdateDamage={updateDamage}
                onDeleteDamage={deleteDamage}
                onUpdateProject={updateProject}
                onDuplicateTurbine={duplicateTurbine}
                onAddMultipleBlades={addMultipleBlades}
                jobHistory={jobHistory}
              />
            }
          />
        </Routes>
        <footer className="app-footer">
          <span>Vetra Van Inventory</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;