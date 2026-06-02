gsap.registerPlugin(ScrollTrigger);
gsap.from('.hero h1',{y:80,opacity:0,duration:1});
function animate(id,target){
 let n=0;const el=document.getElementById(id);
 const i=setInterval(()=>{n++;el.innerText=n;if(n>=target)clearInterval(i)},20);
}
animate('p1',78);animate('p2',500);animate('p3',5);
gsap.utils.toArray('.card').forEach(c=>{
 gsap.from(c,{scrollTrigger:c,y:50,opacity:0,duration:0.8});
});
