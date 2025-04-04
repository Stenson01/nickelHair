

//import React from "react";
import { useState } from "react";
import salon from "./images/beauty_salon.png"
import myImage from "./images/womanhair.png"

export default function App(){
  const [isCliked, setIsClicked] = useState(false)
  const handleClick = () => {
    setIsClicked(!isCliked)
   
    alert("Site en Mode d'essai, Tel: 3481-5903 pour plus de details" );

  };

  

  return(
    <div
    style={{
      backgroundColor :"beige",
      flexDirection :"column",
      width :"100%",
      //height:"500%",
      display :"flex",
      position :"absolute",
      top:0,

    }}
    >
      <div
     style={{
      display :"flex",
      backgroundColor:"black",
      width :"100%",
      height :"50px",
      color:"gold",
      alignItems:"center",
      justifyContent :"space-evenly"
      
     }}
     >

      <h2
      style={{
        marginLeft:15,
        fontSize :30
      }}
      >
        Nickel Hair
      </h2>
      
      
     </div>
     
     <div
     style={{
      display :"flex",
      backgroundColor:"gold",
      width :"100%",
      height :"5px",
      color:"gold",
      alignItems:"center",
      justifyContent :"space-evenly"
      
     }}
     >

     
      
      
     </div>

     <div
     style={{
      
      backgroundColor:"pink",
      width :"100%",
      //height :"850px",
      alignItems:"center",
      justifyItems:"center"
      
      
     }}
     >
      

      <div
      style={{
        flexDirection:"column",
        display:"flex",
        fontSize:"60px",
        margin:20,
        //backgroundColor:"yellow",
        alignItems:"center",
        justifyContent:"center"
        
      }}
      >
        <div
        style={{
          marginTop: 0,
          fontSize:25,
          fontFamily:"sans-serif"
        }}
        >
        Bienvenu pour une Experience
        </div>

        <div
        style={{
          marginBottom: 40,
          fontSize:25,
          fontFamily:"sans-serif"
        }}
        >
        Inoubliable
        </div>

        <div
        onClick={handleClick}
        style={{
          cursor:"pointer",
          backgroundColor: isCliked? "gold" : "black",
          marginTop: 0,
          fontSize:25,
          fontFamily:"sans-serif",
          color:isCliked? "black" : "gold",
          paddingTop:5,
          paddingBottom:5,
          paddingLeft: 15,
          paddingRight:15,
          borderRadius:"25px",
          marginBottom :30
        }}
        >
          Placez un rendez-vous !
        </div>

        

        
        <div>
        Nickel Hair 
        </div>

        <div
        style={{
          marginTop: 0,
          fontSize:20,
          fontFamily:"sans-serif"
        }}
        >
        le meilleur choix en ce qui a trait aux cheuveux et 
        </div>

        <div
        style={{
          marginTop: 0,
          fontSize:20,
          fontFamily:"sans-serif"
        }}
        >
         aux ongles, a la perfection. 
        </div>

        
      </div>

      <img src ={myImage} alt ="Description"
       style={{
        marginTop:20,
        width :"100%",
        

       }} />
   
      
      
     </div>

     <div
     style={{
      margin:"30px",
      marginBottom:"-10px",
      //backgroundColor:"red",
      fontSize:"20px",
      fontFamily:"sans-serif",
      
      height :"100px",
      alignContent :"center",
      justifyItems:"center",
     }}
     >

      <div>
      Cheveux parfaits, ongles, cils et sourcils :
      </div>
      <div>
      le paradis de la beauté à Delmas.
      </div>
       
     </div>

     <div
     style={{
      margin:"30px",
      //backgroundColor:"yellow",
      fontSize:"30px",
      fontFamily:"sans-serif",
      alignContent:"center",
      justifyItems:"center",
      
      height :"150px"
     }}
     >
      <div>
      Vivez l'élégance suprême 
      </div>

      <div>
      au salon de Nickel Hair 
      </div>

      <div>
      à Delmas.
      </div>
     </div>

     <div
     style={{
      backgroundColor :"#DEEf",
     // height :"1000px",
      alignContent:"start",
      justifyItems:"center",
      fontFamily:"sans-serif"

     }}
     >
      <h2>
      Le meilleur de nos services.

      </h2>
      <h5
      style={{
        
        marginTop:-30,
        paddingTop:0,
        padding:30,
        fontSize:18,
        fontFamily:"sans-serif",
        fontWeight:"normal"
        


      }}
      >
      Offrez-vous nos prestations de beauté exquises, des coupes impeccables qui subliment votre visage aux manucures luxueuses qui embellissent vos mains, en passant par des soins précis pour les sourcils et les cils qui illuminent votre regard. Chaque service reflète notre engagement envers votre élégance.
      </h5>

      <div
      onClick={handleClick}
      style={{
        cursor:"pointer",
      
        backgroundColor:"black",
        color: "gold",
        fontSize:"25px",
        paddingLeft:20,
        paddingRight: 20,
        paddingTop:5,
        paddingBottom:5,
        borderRadius:"30px"
      }}
      >
        Book Now
      </div>

      <img src ={salon} alt ="Description"
       style={{
        marginTop:"30px",

        
        width :"100%",
        

       }} />
       <h2>
        Ongle

        </h2>
        <h5
          style={{
            marginTop:-30,
            paddingTop:0,
            padding:25,
            fontSize:20,
            fontFamily:"sans-serif",
            fontWeight:"normal"
            
            
            
          }}
          >
            Découvrez nos luxueux services de manucure et de pédicure, 
            alliant détente absolue et les dernières techniques européennes, 
            comme la manucure russe en gel, le gel builder, 
            le polygel et bien plus encore !
          
           </h5>


        <h2>
        Sourcils

        </h2>
        <h5
          style={{
            marginTop:-30,
            paddingTop:0,
            padding:25,
            fontSize:20,
            fontFamily:"sans-serif",
            fontWeight:"normal"
          }}
          >
          
          Sublimez votre regard avec une lamination, une épilation et une teinture des sourcils réalisées avec précision, parfaitement adaptées à vos traits uniques. Demandez une consultation avec l’un de nos spécialistes.
          </h5>


        <h2>
        Cils

        </h2>
        <h5
          style={{
            marginTop:-30,
            paddingTop:0,
            padding:25,
            fontSize:20,
            fontFamily:"sans-serif",
            fontWeight:"normal"
          }}
          >
          Mettez en valeur vos yeux grâce à nos services de cils réalisés par des experts. Des rehaussements discrets aux extensions volume intense, nous offrons une gamme complète pour un regard envoûtant. Consultez nos spécialistes pour trouver le style de cils qui vous convient parfaitement.
           </h5>

        <h2>
        Cheuveux

        </h2>
        <h5
          style={{ marginTop:-30,
            paddingTop:0,
            padding:25,
            fontSize:20,
            fontFamily:"sans-serif",
            fontWeight:"normal"
          }}
          > Transformez et préservez la santé de vos cheveux grâce à nos experts en mèches, balayage, soins à la kératine et lissages brésiliens. Demandez un test et une consultation gratuits.
            
             </h5>

       

     </div>
     <div
     style={{
      
      
      backgroundColor:"pink",
      
      
      height :"10px"
     }}
     >
      
     </div>
     <div
     style={{
      
      
      backgroundColor:"black",
      padding :20,
      color:"gold",
      height :"20px"
     }}
     >
      Copyright © 2024 Nickel Hair Design !
     </div>

    

    

     



    </div>
  );

}