// src/pages/IRShowerFormsViewContainer.js
import React from 'react';
import { useAuthStore } from '../store/authStore';
import IRShowerFormsView from './IRShowerFormsView';

const IRShowerFormsViewContainer = () => {
    const { profile } = useAuthStore();

    return <IRShowerFormsView profile={profile} />;
};

export default IRShowerFormsViewContainer;
