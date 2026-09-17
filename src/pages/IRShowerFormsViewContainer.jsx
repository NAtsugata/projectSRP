// src/pages/IRShowerFormsViewContainer.js
import { useAuthStore } from '../store/authStore';
import IRShowerFormsView from './IRShowerFormsView';

const IRShowerFormsViewContainer = () => {
    const { profile } = useAuthStore();

    return <IRShowerFormsView profile={profile} />;
};

export default IRShowerFormsViewContainer;
