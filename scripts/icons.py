# Génère les icônes de l'appli (marmite blanche sur fond vert)
from PIL import Image, ImageDraw
G=(17,122,77,255); W=(255,255,255,255)
def pot(size, pad_ratio, rounded):
    S=1024; im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    if rounded: d.rounded_rectangle([0,0,S-1,S-1],radius=230,fill=G)
    else: d.rectangle([0,0,S,S],fill=G)
    k=1-2*pad_ratio; c=S/2
    def P(x,y): return (c+(x-512)*k, c+(y-512)*k)
    lw=int(46*k)
    # corps de la marmite
    x0,y0=P(250,470); x1,y1=P(774,800)
    d.rounded_rectangle([x0,y0,x1,y1],radius=int(130*k),fill=W)
    d.rectangle([x0,y0,x1,y0+(y1-y0)*0.35],fill=W)
    # bord + anses
    a,b=P(200,440); e,f=P(824,500); d.rounded_rectangle([a,b,e,f],radius=int(30*k),fill=W)
    for sx in (150,814):
        a,b=P(sx,455); e,f=P(sx+60,485); d.rounded_rectangle([a,b,e,f],radius=int(15*k),fill=W)
    # vapeur
    for sx in (410,610):
        pts=[P(sx+30*__import__('math').sin(t/6*3.14159*1.6), 380-t*28) for t in range(9)]
        d.line(pts,fill=W,width=lw,joint='curve')
        for q in (pts[0],pts[-1]): d.ellipse([q[0]-lw/2,q[1]-lw/2,q[0]+lw/2,q[1]+lw/2],fill=W)
    return im.resize((size,size),Image.LANCZOS)
pot(192,.14,True).save('public/icon-192.png')
pot(512,.14,True).save('public/icon-512.png')
pot(512,.22,False).save('public/icon-maskable-512.png')
im=pot(180,.16,False); bg=Image.new('RGBA',im.size,G); bg.alpha_composite(im); bg.convert('RGB').save('public/apple-touch-icon.png')
pot(64,.12,True).save('public/favicon.png')
