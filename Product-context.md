# 1. Introduction

## 1.1 Purpose
This document describes the end-to-end requirements for the Codon mobile application. It is intended to serve as a detailed product and system specification for planning, implementation, and validation.

## 1.2 Product Summary
Codon is a mobile-first learning platform for students preparing for NEET UG and other competitive or academic goals. The application combines study resources, assessments, subscriptions, progress tracking, and a mental well-being support experience in one environment.

## 1.3 Scope
- student onboarding and authentication,
- course selection (For now it will be 9th, 10th, Neet UG),
- academic modules such as Q Bank, Test Series, Practice, Learn, and Video Classes,
- subscription and payments through Razorpay,
- progress tracking,
- admin user management,
- mental well-being support experience,

## 1.4 Roles
### Student
A learner who accesses content, takes tests, tracks progress, and uses the mental well-being experience.

### Teacher
An educator who uploads content, creates quizzes, and manages study material.

### Admin
A platform operator responsible for user management, payment monitoring, KYC review, and content oversight, and also the admin needs to approve the content seen by the users.

## 1.5 Access Rules
- Students can access enrolled courses and paid features based on subscription status.
- Teachers can manage only their own content unless granted wider permissions.
- Admins have full platform management ability.

# 2. Core User Flows

## 2.1 Student Onboarding Flow
1. User opens the app.
2. User signs up using phone number and OTP.
3. User views onboarding screens explaining the learning and support experience.
4. User selects a course.
5. User chooses a subscription plan or starts with a trial or starter access.
6. User is granted access to the dashboard.

## 2.2 Student Learning Flow
1. User lands on the home dashboard.
2. User navigates to Q Bank, Test Series, Video Classes, Practice, or Learn.
3. User selects a topic or test.
4. User attempts questions.
5. User receives results and review explanations.
6. User sees progress stored in profile and dashboard.

## 4.3 Mental Well-Being Flow
1. User enters the MMM or wellness section.
2. User sees supportive content, check-ins, or guidance prompts.
3. User engages with reflection or mindfulness content.
4. User receives encouraging feedback and continues learning.

## 2.4 Teacher Content Flow
1. Teacher logs in, using the phone number and OTP.
2. Teacher uploads recorded lecture files, which should be further approved by an admin.
3. Teacher creates tests or quizzes, which should also be approved by an admin.
4. Teacher uploads CSV data for question generation.
5. Teacher publishes content for students.

## 2.5 Admin Flow
1. Admin logs in.
2. Admin views users, payments, subscriptions, and KYC status.
3. Admin approves or manages accounts and content.
4. Admin monitors student progress and content quality.

# 3. Functional Requirements

## 3.1 Authentication
- The app must allow users to sign up and log in.
- The app must support phone number verification, Phone number + OTP is sufficient for login.
- The app must restrict simultaneous login to two devices.
- Also the role of the user is managed by the admin itself, the default role is the student role, and phoneNumber will be the identification of the user.

## 3.2 Student Profile
- The app must allow students to view and edit their profile.
- The app must display subscription validity.
- The subscription plans should be modular, what i mean by that is that they should be created by the admin from the dashboard itself.
- The app must show progress metrics such as attempted tests, scores, and history.

## 3.3 Course and Content Access
- The app must allow students to browse available courses.
- The app must show course-specific content categories.
- The app must restrict content access based on subscription status.

## 3.4 Assessment System
- Students must be able to take quizzes and tests.
- Tests must store scores and attempt history.
- Students must be able to review answers and explanations after completion.
- Admin and teachers must be able to manage test content.

## 3.5 Video Experience
- Students must be able to watch lecture videos.
- The app should support a minimized floating video player experience.

## 3.6 Teacher Module
- Teachers must be able to upload videos.
- Teachers must be able to create quizzes.
- Teachers must be able to upload CSV content for bulk question generation.
- Teachers must be able to publish and manage content.

## 3.7 Payment and Subscription
- The app must support Razorpay payment integration.
- The app must display plan names, pricing, and validity.
- The app must show current subscription status and renewal state.
- Admin must be able to view payment records.

## 3.8 Mental Well-Being Module
- The app must include a dedicated mental well-being section.
- The app must present supportive content, reflection prompts, and wellness guidance.
- The app must promote calm routines and confidence-building habits.
- The experience must feel embedded in the learning journey rather than separate from it.
