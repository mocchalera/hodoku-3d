/* Government figures are kept separate from authored game parameters. */
(function(root){
'use strict';
const DATA={
 title:'令和3年度 全国道路・街路交通情勢調査 一般交通量調査',
 publisher:'国土交通省道路局 / 長野県',
 publication:'長野県公開・2024年9月訂正版', retrieved:'2026-09-08',
 overview:'https://www.pref.nagano.lg.jp/michiken/infra/doro/chosa/r3census.html',
 hourly:'https://www.pref.nagano.lg.jp/michiken/infra/doro/chosa/documents/zkntrf20_ver2.pdf',
 locations:'https://www.pref.nagano.lg.jp/michiken/infra/doro/chosa/documents/kasyo20_ver2.pdf',
 hourlyPage:9, locationsPage:3, firstHour:7,
 note:'交通量だけが公開資料に由来します。交差点、道路の配置、分岐需要、信号、歩行者、バス混入率、乗車人数、予算、工事効果はゲーム用の創作です。現況再現・交通政策の予測ではありません。',
 stations:[
 {id:'11090',name:'宮田',address:'松本市宮田2-10',section:'20300190410',date:'2021年10月（原表：20211000）',
  upSmall:[527,452,407,454,498,512,523,508,497,481,488,488,432,376,281,212,151,88,72,56,48,65,105,280],
  upLarge:[40,53,64,64,49,35,39,40,37,36,24,13,23,31,25,31,25,19,21,19,24,40,50,62],
  downSmall:[348,372,462,508,545,539,551,554,537,533,491,459,518,454,382,264,141,103,62,52,44,62,105,321],
  downLarge:[60,72,90,76,65,55,48,53,49,46,22,14,23,30,27,25,27,31,35,40,39,43,84,100]},
 {id:'11100',name:'鎌田',address:'松本市鎌田2丁目7-1',section:'20300190420',date:'2021年10月21日',
  upSmall:[386,407,371,334,313,281,227,231,202,402,362,356,384,307,261,169,142,98,77,54,61,72,104,298],
  upLarge:[48,48,79,77,40,23,21,34,49,44,34,23,37,38,26,38,26,19,24,18,33,37,58,61],
  downSmall:[424,433,420,451,456,461,445,487,427,519,495,460,451,378,330,189,121,101,58,40,48,73,115,311],
  downLarge:[60,69,85,80,72,49,58,59,58,46,20,30,27,29,26,20,32,28,26,50,52,42,73,95]},
 {id:'11110',name:'渚',address:'松本市渚1丁目5-11',section:'20300190440',date:'2021年10月21日',
  upSmall:[520,530,463,416,481,407,406,466,437,545,647,558,464,361,273,164,123,53,56,49,62,84,179,384],
  upLarge:[32,45,103,96,67,48,52,55,87,56,32,19,33,37,28,32,27,13,17,13,28,36,50,44],
  downSmall:[536,470,493,513,534,557,547,536,497,583,590,554,568,514,396,289,191,130,70,51,57,86,136,381],
  downLarge:[47,55,83,71,68,54,58,60,44,42,15,22,24,25,26,14,30,26,22,39,41,33,62,76]}
 ]
};
if(typeof module!=='undefined'&&module.exports) module.exports=DATA;
root.HODOKU_DATA=DATA;
})(typeof globalThis!=='undefined'?globalThis:this);
