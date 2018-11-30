'use strict';

 try
 {
 google.charts.load('current', {packages: ['corechart']});
 google.charts.setOnLoadCallback(drawChart);
 }
 catch(e)
 {
   
 }

 let g_LB_Data = {};
 //let g_MC_BTC_Price = 1000000;
 let g_CurrentPair = utils.DEFAULT_PAIR;
 let g_currentChartPeriod = 24;

 $(() => {
     const currentPair = storage.getItemS('CurrentPair');
     if (currentPair != null)
         g_CurrentPair = currentPair.value;

     const ChartPeriod = storage.getItem('ChartPeriod');
     if (ChartPeriod != null)
         g_currentChartPeriod = ChartPeriod.value;

     utils.CreateSocket(onSocketMessage, onOpenSocket);

    
 });

 

 function onOpenSocket()
 {
   socket.send(JSON.stringify({request: 'getchart', message: [utils.MAIN_COIN, g_CurrentPair, g_currentChartPeriod]}));
   setInterval(() => {  socket.send(JSON.stringify({request: 'getchart', message: [utils.MAIN_COIN, g_CurrentPair, g_currentChartPeriod]}));}, 60000)
 }

 function onSocketMessage(event)
 {
   var data = {};
   try { data = JSON.parse(event.data); }
   catch(e) {return;}
   
   if (!data.request || data.request == 'error' || !data.message)
     return;
     
   if (data.request == 'chartdata')
   {
     if (data.message.data.chart)
       drawChart(data.message.data.chart);
     return;
   }
 }

 let g_TableLengthPrev = 0;
 function drawChart(chartData)
 {
   try
   {
     if (!chartData.length)
       return;
     if (!google.visualization || !google.visualization['arrayToDataTable'])
       return setTimeout(drawChart, 1000, chartData);
     
     SetChartLegend()
       
     var tmp = [];
     for (var j=chartData.length-1; j>=0; j--)
       tmp.push(chartData[j]);
       
     chartData = tmp;
     
     const group = 
       (g_currentChartPeriod == 24) ? 360000 :
       (g_currentChartPeriod == 250) ? 3600000 :
       (g_currentChartPeriod == 1000) ? 14400000 :
       (g_currentChartPeriod == 6000) ? 86400000 : 360000;

	 var globalMax = 0;
     var globalMin = 1000000000;
     var globalVolMax = 0;
     var table = [];
     for (var i=0; i<chartData.length; i++)  
     {
       const time = utils.timeConverter(chartData[i].t10min*group, true);
       //const time = new Date(chartData[i].t10min*360000);
       const timeStart = chartData[i].t10min;
       
       var min = chartData[i].avg_10min;
       var init = chartData[i].avg_10min;
       var final = chartData[i].avg_10min;
       var max = chartData[i].avg_10min;
       var volume = chartData[i].volume*1;
       
       for (var j=i+1; j<chartData.length; j++)
       {
         if (chartData[j].t10min*1 > timeStart*1+10)
           break;
         
         if (chartData[j].avg_10min*1 < min)
           min = chartData[j].avg_10min;
         if (chartData[j].avg_10min*1 > max)
           max = chartData[j].avg_10min;
           
         final = chartData[j].avg_10min;
         volume += chartData[j].volume*1;
         i++;
       }
       
       if (globalMax < max/1000000)  globalMax = max/1000000;
       if (globalMin > min/1000000)  globalMin = min/1000000;
       if (globalVolMax < volume) globalVolMax = volume;
       
       table.push([time, volume, min/1000000, init/1000000, final/1000000, max/1000000]);
       //table.push([time, min/1000000, init/1000000, final/1000000, max/1000000]);
     }
     
     if (!table.length || table.length < g_TableLengthPrev-2)
       return;
       
       var vAxisMin = 2*globalMin > globalMax ? 2*globalMin - globalMax : 0;
     /*var scale = (globalMin) / (globalVolMax + vAxisMin);   
     for (var i=0; i<table.length; i++)
     {
       table[i][1] = (table[i][1] + vAxisMin) * scale;
     }*/
       
     g_TableLengthPrev = table.length;
       
     if (table.length > 24)
       table = table.slice(table.length - 24);
       
     var data = google.visualization.arrayToDataTable(table, true);
     var options = {
         //title: g_CurrentPair,
         /*hAxis: {
           minValue: 0,
           maxValue: 24,
           ticks: [0, 4, 8, 12, 16, 20, 24]
         },*/
         //width: 800,
         legend: 'none',
         
          candlestick: {
            fallingColor: { strokeWidth: 0, fill: '#E75162' }, // red
            risingColor: { strokeWidth: 0, fill: '#5BB789' }   // green
          },
          
         colors: ['blue'],
         //vAxis: {viewWindow: {min: vAxisMin} },
         /*explorer: {
                 axis: 'horizontal',
                 keepInBounds: true,
                 maxZoomIn: 4.0
         },*/
         seriesType: 'candlesticks',
         backgroundColor: 'none',
         series: {0: {type: 'bars', targetAxisIndex: 1, color: '#eaeaea'}}
     };
     
     var chart = new google.visualization.ComboChart(document.getElementById('chart_div'));
     //var chart = new google.visualization.CandlestickChart(document.getElementById('chart_div'));
     chart.draw(data, options);
     
   }
   catch(e)
   {
     
   }
 }

 function SetChartLegend()
 {
     const cntObject = storage.getItem('coinNameToTicker');
     if (cntObject == null || !cntObject.value)
         return;
     const coinNameToTicker = cntObject.value;
     
     if (!coinNameToTicker[g_CurrentPair] || !coinNameToTicker[g_CurrentPair].ticker || !coinNameToTicker[utils.MAIN_COIN])
         return setTimeout(SetChartLegend, 1000);

     
   const MC = coinNameToTicker[utils.MAIN_COIN].ticker; 
   const COIN = coinNameToTicker[g_CurrentPair].ticker
   

   $.getJSON( "/api/v1/public/getmarketsummary?market="+MC+"-"+COIN+"&period="+g_currentChartPeriod, ret => {
     if (!ret || !ret.success || ret.success != true || MC != coinNameToTicker[utils.MAIN_COIN].ticker || COIN != coinNameToTicker[g_CurrentPair].ticker) 
       return;
     
     AddCoinInfo(ret);
     
     const group = 
       (g_currentChartPeriod == 24) ? '24h: ' :
       (g_currentChartPeriod == 250) ? '7d: ' :
       (g_currentChartPeriod == 1000) ? '1M: ':
       (g_currentChartPeriod == 6000) ? '6M: ': '24h: ';

	let iswdisabled = '';
	  if (ret.result.coin_info.withdraw == "Disabled"){
		iswdisabled = '<span class="badge alert-danger">Wallet Disabled</span>';
	  }
	  let istdisabled = '';
	  if (ret.result.coin_info.orders == "Disabled"){
		istdisabled = '<span class="badge alert-danger">Trading disabled</span>';
	  }
	  
	let featmarket = '';
      if (g_CurrentPair == utils.DEFAULT_PAIR){
      featmarket = '<h4><span class="badge alert-success">⭐️ Featured</span></h4>';
     	//istdisabled =$('<img src="https://i.imgur.com/DHFGJez.png">');
   	  }
   	  
   	  let competition = '';
      if (g_CurrentPair == 'Dogecoin'){
      competition = '<h4><span class="badge alert-success">🏆 Competition soon</span></h4>';
     	//istdisabled =$('<img src="https://i.imgur.com/DHFGJez.png">');
   	  }
   	  
   	let ico = '';
      if (g_CurrentPair == 'SedusCoin'){
      ico = '<h5><span class="badge alert-success">This is a Sedus Presale, Please visit for INFO : <a href="https://discord.gg/VMB52rU">https://discord.gg/VMB52rU</a></span></h5>';
     	//istdisabled =$('<img src="https://i.imgur.com/DHFGJez.png">');
   	  }
	  
     const legend = $(
       '<div class="row"><div class="col-xs-3" style="vertical-align: top;padding-right:0;padding-left:20px;display: inline-block;">'+
       '<ul class="nav" style="padding-bottom: 5px; display:inline-block;" >'+
         '<li class="nav-item ml-2" style="display:inline-block;"><img src="'+unescape(ret.result.coin_icon_src)+'" width=30/></li>'+
         '<li class="nav-item ml-2" style="display:inline-block;"><h4>'+MC+' / '+COIN+'</h4></li>'+
         '<li class="nav-item ml-2" style="display:block;">'+ico+' '+competition+' '+featmarket+' '+iswdisabled+' '+istdisabled+'</li>'+
	 '</ul></div><div class="col-xs-9" style="display: inline-block; vertical-align: top;padding-left:20px;"><div class="row"><div class="col-xs-6 mobchartstats" style="display: inline-block;"><ul class="nav" style="padding-bottom: 5px; display:block;" >'+
         '<li class="nav-item ml-2">'+group+'High: '+(ret.result.High*1).toFixed(8)+'</li>'+
         '<li class="nav-item ml-2">'+group+'Low: '+(ret.result.Low*1).toFixed(8)+'</li>'+
         '</ul></div><div class="col-xs-6 mobchartstatsV" style="display: inline-block;"><ul class="nav" style="padding-bottom: 5px; display:block;" >'+
         '<li class="nav-item ml-2">'+group+'Vol: '+(ret.result.Volume*1).toFixed(8)+' '+COIN+'</li>'+
         '<li class="nav-item ml-2">'+group+'Vol: '+(ret.result.BTCVolume*1).toFixed(8)+' '+MC+'</li>'+
         '</ul></div></div></div></div>'
       )//('<h4>'+COIN+' / '+MC+'</h4>');
     $('#chart_legend').empty();
     $('#chart_legend').append(legend);
     
   });
 }

 function AddCoinInfo(info)
 {
   if (!info.result || !info.result.coin_info || !info.result.coin_info.page)
     return;
    
    let featuredmarket = '';
    // if (g_CurrentPair == utils.DEFAULT_PAIR){
//      	featuredmarket =$('<img src="https://i.imgur.com/DHFGJez.png">');
//     }

	  let telegram = '';
      if (info.result.coin_info.telegram){
      telegram = '<a target="_blank" href="'+(info.result.coin_info.telegram || "")+'"><img height="36" src="/telegram.svg" title="Telegram"></a>';
   	  }
   	  
	  let discord = '';
      if (info.result.coin_info.discord){
      discord = '<a target="_blank" href="'+(info.result.coin_info.discord || "")+'"><img height="36" src="/discord.png" title="Discord"></a>';
   	  }
   	  
   	  let github = '';
      if (info.result.coin_info.github){
      github = '<a target="_blank" href="'+(info.result.coin_info.github || "")+'"><img height="36" src="/github.png" title="GitHub"></a>';
   	  }
   	  
   	  let explorer = '';
      if (info.result.coin_info.explorer){
      explorer = '<a target="_blank" href="'+(info.result.coin_info.explorer || "")+'"><img height="36" src="/explorer.png" title="Block Explorer"></a>';
   	  }
   	  let website = '';
      if (info.result.coin_info.website){
      website = '<a target="_blank" href="'+(info.result.coin_info.website || "")+'"><img height="36" src="/website.png" title="Website"></a>';
   	  }
   	  
   $('#coin_legend').empty().append(featuredmarket);
   
   const p1 = $('<p style="margin:4px 0;"><strong>Coin Information Links:</strong> <a target="_blank" href="'+(info.result.coin_info.page || "")+'"><img height="36" src="/bitcoin.svg" title="Bitcoin Talk"></a> '+discord+' '+github+' '+telegram+' '+explorer+' '+website+'</p>');
   $('#coin_info').empty().append(p1);
 }
