import { useState, useEffect, useRef } from 'react'
import { Routes, HashRouter, Route } from 'react-router-dom';


import LEDFruitNinja from './Games/Fruit';

import RunningMan2 from './Games/Run2';
import OsuGame from './Games/Osu';

import GameSelect from './Games/Home';
import SessionConnect from './Games/SessionConnect';

export default function App(){

  return (
    // <div>
    //   <TriviaWall/>
    // </div>      

    <HashRouter>
      <Routes>

        <Route path="/"
        element={
          <div>
            <SessionConnect/>
          </div>
        }/>

                <Route path="/home"
        element={
          <div>
            <GameSelect/>
          </div>
        }/>
        


        <Route path="/running"
        element={
          <div>
            <RunningMan2/>
          </div>
        }/>
        
      
        <Route path="/osu"
        element={
          <div>
            <OsuGame/>
          </div>
        }/>

        <Route path="/fruit"
        element={
          <div>
            <LEDFruitNinja/>
          </div>
        }/>
      </Routes>
    </HashRouter>
 
  )
}

// export default App;