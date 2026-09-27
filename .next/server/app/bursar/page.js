(()=>{var e={};e.id=3338,e.ids=[3338],e.modules={53524:e=>{"use strict";e.exports=require("@prisma/client")},72934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},39491:e=>{"use strict";e.exports=require("assert")},50852:e=>{"use strict";e.exports=require("async_hooks")},14300:e=>{"use strict";e.exports=require("buffer")},6113:e=>{"use strict";e.exports=require("crypto")},82361:e=>{"use strict";e.exports=require("events")},57147:e=>{"use strict";e.exports=require("fs")},13685:e=>{"use strict";e.exports=require("http")},95687:e=>{"use strict";e.exports=require("https")},17718:e=>{"use strict";e.exports=require("node:child_process")},6005:e=>{"use strict";e.exports=require("node:crypto")},30604:e=>{"use strict";e.exports=require("node:dns")},15673:e=>{"use strict";e.exports=require("node:events")},87561:e=>{"use strict";e.exports=require("node:fs")},88849:e=>{"use strict";e.exports=require("node:http")},22286:e=>{"use strict";e.exports=require("node:https")},87503:e=>{"use strict";e.exports=require("node:net")},70612:e=>{"use strict";e.exports=require("node:os")},49411:e=>{"use strict";e.exports=require("node:path")},84492:e=>{"use strict";e.exports=require("node:stream")},31764:e=>{"use strict";e.exports=require("node:tls")},41041:e=>{"use strict";e.exports=require("node:url")},47261:e=>{"use strict";e.exports=require("node:util")},65628:e=>{"use strict";e.exports=require("node:zlib")},71017:e=>{"use strict";e.exports=require("path")},63477:e=>{"use strict";e.exports=require("querystring")},57310:e=>{"use strict";e.exports=require("url")},73837:e=>{"use strict";e.exports=require("util")},59796:e=>{"use strict";e.exports=require("zlib")},74337:(e,t,r)=>{"use strict";r.r(t),r.d(t,{GlobalError:()=>i.a,__next_app__:()=>x,originalPathname:()=>h,pages:()=>o,routeModule:()=>u,tree:()=>c}),r(23261),r(5041),r(1972),r(46406),r(6042);var s=r(24285),a=r(42875),d=r(48190),i=r.n(d),n=r(63289),l={};for(let e in n)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>n[e]);r.d(t,l);let c=["",{children:["bursar",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(r.bind(r,23261)),"C:\\Users\\DELL\\Desktop\\SchoolERP\\src\\app\\bursar\\page.tsx"]}]},{layout:[()=>Promise.resolve().then(r.bind(r,5041)),"C:\\Users\\DELL\\Desktop\\SchoolERP\\src\\app\\bursar\\layout.tsx"],loading:[()=>Promise.resolve().then(r.bind(r,1972)),"C:\\Users\\DELL\\Desktop\\SchoolERP\\src\\app\\bursar\\loading.tsx"]}]},{layout:[()=>Promise.resolve().then(r.bind(r,46406)),"C:\\Users\\DELL\\Desktop\\SchoolERP\\src\\app\\layout.tsx"],"not-found":[()=>Promise.resolve().then(r.t.bind(r,6042,23)),"next/dist/client/components/not-found-error"]}],o=["C:\\Users\\DELL\\Desktop\\SchoolERP\\src\\app\\bursar\\page.tsx"],h="/bursar/page",x={require:r,loadChunk:()=>Promise.resolve()},u=new s.AppPageRouteModule({definition:{kind:a.x.APP_PAGE,page:"/bursar/page",pathname:"/bursar",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:c}})},61567:(e,t,r)=>{let s={"065db304b59e6659e8591823f4e9e7ed64b0a76f":()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.getBursarContext),"4b3da215696f4d4c64df9a0227ec2603fad062ab":()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.searchStudentsWithLedger),"561bbddb13d717ca9dfb84e657c9dbbadda4059c":()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.getBursarDashboardStats),"57d3dba9c71aa928409d631c874860d029024285":()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.getBursarFeeTemplates),"77de3def654980609a556b26510ea26621ff1eed":()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.getBursarReceipts),"899150674069578ecca99b0906d41e4c9bcfb401":()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.$$ACTION_0),"8b56d7e5d775fc9258cae1f5f393d543a639ff12":()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.createBursarInvoice),"9e5b92f695c116c74db42fc7c279d7e81b33dfbf":()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.updateSchoolSettlementBank),abbacba4ce3a4ce02f035c48e0e1702b1a73b28d:()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.createBursarFeeTemplate),baf458843f37ec33a8bfcc321631fe1be1502057:()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.recordCounterPayment),c373454df8d341065facd10c5a22ae21f24b6455:()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.getBursarDefaultersReport),caefaf02c065133a7f5adc990e0161180fb096fa:()=>Promise.resolve().then(r.bind(r,85544)).then(e=>e.getBursarInvoices)};async function a(e,...t){return(await s[e]()).apply(null,t)}e.exports={"065db304b59e6659e8591823f4e9e7ed64b0a76f":a.bind(null,"065db304b59e6659e8591823f4e9e7ed64b0a76f"),"4b3da215696f4d4c64df9a0227ec2603fad062ab":a.bind(null,"4b3da215696f4d4c64df9a0227ec2603fad062ab"),"561bbddb13d717ca9dfb84e657c9dbbadda4059c":a.bind(null,"561bbddb13d717ca9dfb84e657c9dbbadda4059c"),"57d3dba9c71aa928409d631c874860d029024285":a.bind(null,"57d3dba9c71aa928409d631c874860d029024285"),"77de3def654980609a556b26510ea26621ff1eed":a.bind(null,"77de3def654980609a556b26510ea26621ff1eed"),"899150674069578ecca99b0906d41e4c9bcfb401":a.bind(null,"899150674069578ecca99b0906d41e4c9bcfb401"),"8b56d7e5d775fc9258cae1f5f393d543a639ff12":a.bind(null,"8b56d7e5d775fc9258cae1f5f393d543a639ff12"),"9e5b92f695c116c74db42fc7c279d7e81b33dfbf":a.bind(null,"9e5b92f695c116c74db42fc7c279d7e81b33dfbf"),abbacba4ce3a4ce02f035c48e0e1702b1a73b28d:a.bind(null,"abbacba4ce3a4ce02f035c48e0e1702b1a73b28d"),baf458843f37ec33a8bfcc321631fe1be1502057:a.bind(null,"baf458843f37ec33a8bfcc321631fe1be1502057"),c373454df8d341065facd10c5a22ae21f24b6455:a.bind(null,"c373454df8d341065facd10c5a22ae21f24b6455"),caefaf02c065133a7f5adc990e0161180fb096fa:a.bind(null,"caefaf02c065133a7f5adc990e0161180fb096fa")}},42868:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,73510,23))},88147:(e,t,r)=>{"use strict";r.d(t,{Z:()=>l});var s=r(32178);/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),d=(...e)=>e.filter((e,t,r)=>!!e&&r.indexOf(e)===t).join(" ");/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var i={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=(0,s.forwardRef)(({color:e="currentColor",size:t=24,strokeWidth:r=2,absoluteStrokeWidth:a,className:n="",children:l,iconNode:c,...o},h)=>(0,s.createElement)("svg",{ref:h,...i,width:t,height:t,stroke:e,strokeWidth:a?24*Number(r)/Number(t):r,className:d("lucide",n),...o},[...c.map(([e,t])=>(0,s.createElement)(e,t)),...Array.isArray(l)?l:[l]])),l=(e,t)=>{let r=(0,s.forwardRef)(({className:r,...i},l)=>(0,s.createElement)(n,{ref:l,iconNode:t,className:d(`lucide-${a(e)}`,r),...i}));return r.displayName=`${e}`,r}},93579:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]])},95682:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("Banknote",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]])},76762:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("Building2",[["path",{d:"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",key:"1b4qmf"}],["path",{d:"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",key:"i71pzd"}],["path",{d:"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",key:"10jefs"}],["path",{d:"M10 6h4",key:"1itunk"}],["path",{d:"M10 10h4",key:"tcdvrf"}],["path",{d:"M10 14h4",key:"kelpxr"}],["path",{d:"M10 18h4",key:"1ulq68"}]])},36111:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("Coins",[["circle",{cx:"8",cy:"8",r:"6",key:"3yglwk"}],["path",{d:"M18.09 10.37A6 6 0 1 1 10.34 18",key:"t5s6rm"}],["path",{d:"M7 6h1v4",key:"1obek4"}],["path",{d:"m16.71 13.88.7.71-2.82 2.82",key:"1rbuyh"}]])},32430:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("ExternalLink",[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]])},81360:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("FileBarChart",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M8 18v-2",key:"qcmpov"}],["path",{d:"M12 18v-4",key:"q1q25u"}],["path",{d:"M16 18v-6",key:"15y0np"}]])},91726:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("FileSpreadsheet",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]])},75238:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("Layers",[["path",{d:"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",key:"8b97xw"}],["path",{d:"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",key:"dd6zsq"}],["path",{d:"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",key:"ep9fru"}]])},21747:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("LayoutDashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]])},75750:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("LogOut",[["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}],["polyline",{points:"16 17 21 12 16 7",key:"1gabdz"}],["line",{x1:"21",x2:"9",y1:"12",y2:"12",key:"1uyos4"}]])},18348:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("Menu",[["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}],["line",{x1:"4",x2:"20",y1:"6",y2:"6",key:"1owob3"}],["line",{x1:"4",x2:"20",y1:"18",y2:"18",key:"yk5zj1"}]])},64766:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("Moon",[["path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",key:"a7tn18"}]])},69472:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("Receipt",[["path",{d:"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z",key:"q3az6g"}],["path",{d:"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8",key:"1h4pet"}],["path",{d:"M12 17.5v-11",key:"1jc1ny"}]])},41253:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("ShieldCheck",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]])},12479:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("Sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]])},54521:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(88147).Z)("X",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]])},85723:(e,t,r)=>{"use strict";r.d(t,{default:()=>a.a});var s=r(73510),a=r.n(s)},4619:(e,t,r)=>{"use strict";var s=r(9877);r.o(s,"useParams")&&r.d(t,{useParams:function(){return s.useParams}}),r.o(s,"usePathname")&&r.d(t,{usePathname:function(){return s.usePathname}}),r.o(s,"useRouter")&&r.d(t,{useRouter:function(){return s.useRouter}}),r.o(s,"useSearchParams")&&r.d(t,{useSearchParams:function(){return s.useSearchParams}})},78906:(e,t,r)=>{"use strict";r.d(t,{Z:()=>l});var s=r(60561);/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),d=(...e)=>e.filter((e,t,r)=>!!e&&r.indexOf(e)===t).join(" ");/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var i={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=(0,s.forwardRef)(({color:e="currentColor",size:t=24,strokeWidth:r=2,absoluteStrokeWidth:a,className:n="",children:l,iconNode:c,...o},h)=>(0,s.createElement)("svg",{ref:h,...i,width:t,height:t,stroke:e,strokeWidth:a?24*Number(r)/Number(t):r,className:d("lucide",n),...o},[...c.map(([e,t])=>(0,s.createElement)(e,t)),...Array.isArray(l)?l:[l]])),l=(e,t)=>{let r=(0,s.forwardRef)(({className:r,...i},l)=>(0,s.createElement)(n,{ref:l,iconNode:t,className:d(`lucide-${a(e)}`,r),...i}));return r.displayName=`${e}`,r}},6819:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(78906).Z)("ArrowRight",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]])},21683:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(78906).Z)("ShieldCheck",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]])},16834:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(78906).Z)("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]])},66192:(e,t,r)=>{"use strict";r.d(t,{Z:()=>s});/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,r(78906).Z)("Wallet",[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]])},23496:(e,t,r)=>{"use strict";r.d(t,{default:()=>a.a});var s=r(90821),a=r.n(s)},90821:(e,t,r)=>{"use strict";let{createProxy:s}=r(16592);e.exports=s("C:\\Users\\DELL\\Desktop\\SchoolERP\\node_modules\\next\\dist\\client\\link.js")},23261:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>b});var s=r(9807);r(60561);var a=r(23496),d=r(85544),i=r(78906);/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=(0,i.Z)("Banknote",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]]);var l=r(21683);/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let c=(0,i.Z)("CircleAlert",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]]);var o=r(6819);/**
 * @license lucide-react v0.378.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let h=(0,i.Z)("FileSpreadsheet",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M8 13h2",key:"yr2amv"}],["path",{d:"M14 13h2",key:"un5t4a"}],["path",{d:"M8 17h2",key:"2yhykz"}],["path",{d:"M14 17h2",key:"10kma7"}]]);var x=r(16834),u=r(66192);function p(e){return`₦${(e||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}`}async function b(){let e=await (0,d.getBursarContext)(),t=e?.schoolId||"default-school",r=await (0,d.getBursarDashboardStats)(t);return(0,s.jsxs)("div",{className:"space-y-6",children:[s.jsx("div",{className:"relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800",children:(0,s.jsxs)("div",{className:"relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6",children:[(0,s.jsxs)("div",{className:"space-y-2",children:[(0,s.jsxs)("div",{className:"inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold",children:[s.jsx("span",{className:"w-2 h-2 rounded-full bg-emerald-400 animate-pulse"}),(0,s.jsxs)("span",{children:["Bursary Treasury Active • ",e?.schoolName]})]}),s.jsx("h1",{className:"text-2xl sm:text-3xl font-black tracking-tight text-white",children:"Bursar Command Center"}),s.jsx("p",{className:"text-slate-300 text-xs sm:text-sm max-w-2xl font-medium",children:"Real-time tuition cashflow, counter payments, parent bank transfer approvals, and institutional financial accounting."})]}),(0,s.jsxs)("div",{className:"flex flex-wrap items-center gap-3",children:[(0,s.jsxs)(a.default,{href:"/bursar/collect",className:"flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer",children:[s.jsx(n,{className:"w-4 h-4"}),s.jsx("span",{children:"Collect Fee"})]}),(0,s.jsxs)(a.default,{href:"/bursar/verifications",className:"flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer",children:[s.jsx(l.Z,{className:"w-4 h-4"}),s.jsx("span",{children:"Verify Transfers"})]})]})]})}),r.pendingVerificationsCount>0&&(0,s.jsxs)("div",{className:"p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900 dark:text-amber-300",children:[(0,s.jsxs)("div",{className:"flex items-center gap-3",children:[s.jsx("div",{className:"w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0",children:s.jsx(c,{className:"w-5 h-5 animate-bounce"})}),(0,s.jsxs)("div",{children:[(0,s.jsxs)("h3",{className:"font-extrabold text-sm text-slate-900 dark:text-white",children:[r.pendingVerificationsCount," Bank Transfer ",1===r.pendingVerificationsCount?"Receipt":"Receipts"," Awaiting Bursar Approval"]}),s.jsx("p",{className:"text-xs text-amber-800 dark:text-amber-300/80",children:"Parents have uploaded manual payment proofs. Confirm funds in the school account and credit student invoices."})]})]}),(0,s.jsxs)(a.default,{href:"/bursar/verifications",className:"inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-xs whitespace-nowrap self-start sm:self-auto",children:[s.jsx("span",{children:"Review Queue"}),s.jsx(o.Z,{className:"w-3.5 h-3.5"})]})]}),(0,s.jsxs)("div",{className:"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6",children:[(0,s.jsxs)("div",{className:"p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[s.jsx("span",{className:"text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400",children:"Total Invoiced"}),s.jsx("div",{className:"p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400",children:s.jsx(h,{className:"w-5 h-5"})})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"text-xl sm:text-2xl font-black text-slate-900 dark:text-white",children:p(r.totalInvoiced)}),(0,s.jsxs)("p",{className:"text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-1",children:["Across ",r.totalInvoicesCount," student fee invoices"]})]})]}),(0,s.jsxs)("div",{className:"p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[s.jsx("span",{className:"text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400",children:"Total Collections"}),s.jsx("div",{className:"p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",children:s.jsx(x.Z,{className:"w-5 h-5"})})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400",children:p(r.totalCollected)}),s.jsx("div",{className:"flex items-center gap-2 mt-1",children:(0,s.jsxs)("span",{className:"text-xs font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md",children:[r.collectionRate,"% Recovered"]})})]})]}),(0,s.jsxs)("div",{className:"p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[s.jsx("span",{className:"text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400",children:"Outstanding Debt"}),s.jsx("div",{className:"p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400",children:s.jsx(c,{className:"w-5 h-5"})})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400",children:p(r.outstandingBalance)}),s.jsx("p",{className:"text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-1",children:"Unpaid tuition & sundry levies"})]})]}),(0,s.jsxs)("div",{className:"p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[s.jsx("span",{className:"text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400",children:"Today's Inflow"}),s.jsx("div",{className:"p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400",children:s.jsx(u.Z,{className:"w-5 h-5"})})]}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400",children:p(r.todayCollected)}),s.jsx("p",{className:"text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-1",children:"Collections recorded today"})]})]})]})]})}}};var t=require("../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[6039,694,5219,5767,1932,3510,3044,9753,9850,3589,6994,5530,8071],()=>r(74337));module.exports=s})();