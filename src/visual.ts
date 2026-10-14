import {AXES,type Summary} from './model.js';
export function radarSvg(s:Summary,options:{dark?:boolean}={}){
 const point=(i:number,r:number)=>[300+Math.sin(i*Math.PI/3)*r,265-Math.cos(i*Math.PI/3)*r];
 const polygon=(r:number)=>AXES.map((_,i)=>point(i,r).join(',')).join(' ');
 const lines=AXES.map((_,i)=>{const[x,y]=point(i,180);return `<line x1="300" y1="265" x2="${x}" y2="${y}"/>`;}).join('');
 const labels=AXES.map((name,i)=>{const[x,y]=point(i,227);return `<text x="${x}" y="${y}" text-anchor="middle" font-size="15" fill="#233e34">${name}</text><text x="${x}" y="${y+20}" text-anchor="middle" font-size="13" fill="#5f756b">${s.dimensions[i]===null?'未知':Math.round(s.dimensions[i]!)}</text>`;}).join('');
 const known=s.dimensions.every(n=>n!==null);const shape=known?`<polygon points="${s.dimensions.map((n,i)=>point(i,n!*1.8).join(',')).join(' ')}" fill="#3c967c" fill-opacity="0.18" stroke="#348169" stroke-width="2"/>`:'';
 const dots=s.dimensions.map((n,i)=>n===null?'':`<circle cx="${point(i,n*1.8)[0]}" cy="${point(i,n*1.8)[1]}" r="5" fill="#348169"/>`).join('');
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 545" role="img" font-family="system-ui" aria-label="六维雷达图；${s.total===null?'总分未知':`总分${s.total}`}；证据覆盖${Math.round(s.coverage*100)}%"><g fill="none" stroke="#c9d4c7" stroke-width="1">${[45,90,135,180].map(r=>`<polygon points="${polygon(r)}"/>`).join('')}${lines}</g>${shape}${dots}${labels}<circle cx="300" cy="265" r="60" fill="#f4f3eb"/><text x="300" y="264" text-anchor="middle" font-size="40" font-weight="600" fill="#173f35">${s.total??'—'}</text><text x="300" y="289" text-anchor="middle" font-size="12" fill="#62746a">${s.total===null?'证据不完整':'综合分 / 100'}</text><text x="300" y="526" text-anchor="middle" font-size="12" fill="#62746a">暂定轮廓 · 未知维度不画为零 · 原创指标，非认证</text></svg>`;
 if(options.dark)for(const[a,b]of Object.entries({'#c9d4c7':'#345139','#233e34':'#d6e6c8','#5f756b':'#9eb69a','#3c967c':'#a4e58a','#348169':'#a4e58a','#f4f3eb':'#111913','#173f35':'#a4e58a','#62746a':'#7c967c'}))svg=svg.replaceAll(a,b);
 return svg;
}
